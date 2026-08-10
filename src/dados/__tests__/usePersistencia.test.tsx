import { act, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { Acao, LojaProvider, useLoja } from '../../estado/store';
import { EstadoPersistido } from '../persistido';
import { RepositorioLocal } from '../repositorio';
import { criarRepositorioMemoria } from '../repositorioMemoria';
import { usePersistencia } from '../usePersistencia';

/**
 * O gancho é onde a regra 4 vive: escrita local primeiro, disco depois, e
 * nunca `await` no caminho do lançamento. Os testes cobrem o que garante isso
 * — que ação de UI não encosta no banco e que uma falha não derruba a tela.
 */

function repositorioEspiao(base: RepositorioLocal = criarRepositorioMemoria()) {
  const chamadas: { antes: EstadoPersistido | null; depois: EstadoPersistido }[] = [];
  let falharNaProxima: Error | null = null;

  const repo: RepositorioLocal = {
    ...base,
    async salvar(antes, depois) {
      if (falharNaProxima) {
        const erro = falharNaProxima;
        falharNaProxima = null;
        throw erro;
      }
      chamadas.push({ antes, depois });
      return base.salvar(antes, depois);
    },
  };

  return {
    repo,
    chamadas,
    falharUmaVez: (erro: Error) => {
      falharNaProxima = erro;
    },
  };
}

/**
 * Expõe `despachar` para o teste, com a persistência ligada por dentro.
 *
 * Tudo passa por `await act(async …)`: a gravação é um efeito assíncrono, e
 * misturar `act` síncrono com assíncrono faz o React reclamar de escopos
 * sobrepostos e engolir o resultado.
 */
async function montar(repo: RepositorioLocal | null, aoFalhar?: (e: unknown) => void) {
  let despachar!: React.Dispatch<Acao>;

  function Sonda() {
    const loja = useLoja();
    despachar = loja.despachar;
    usePersistencia(repo, aoFalhar);
    return <Text>{String(loja.estado.transacoes.length)}</Text>;
  }

  // `render` desta versão do RNTL devolve Promise e já embrulha em `act` por
  // dentro — sem o `await`, o componente nem chega a montar.
  const tela = await render(
    <LojaProvider>
      <Sonda />
    </LojaProvider>,
  );

  return {
    tela,
    agir: async (a: Acao) => {
      await act(async () => {
        despachar(a);
      });
    },
  };
}

describe('usePersistencia', () => {
  it('não grava nada só por montar', async () => {
    const { repo, chamadas } = repositorioEspiao();
    await montar(repo);
    expect(chamadas).toHaveLength(0);
  });

  it('grava quando uma entidade muda', async () => {
    const { repo, chamadas } = repositorioEspiao();
    const { agir } = await montar(repo);

    await agir({ tipo: 'REGISTRO_RAPIDO', categoriaId: 'mercado', valorCentavos: 2000 });

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].depois.transacoes.length).toBe(chamadas[0].antes!.transacoes.length + 1);
  });

  it('ação de UI não encosta no banco', async () => {
    const { repo, chamadas } = repositorioEspiao();
    const { agir } = await montar(repo);

    // Digitar no teclado troca `rascunho` a cada toque; navegar troca `tela`.
    // Se qualquer um disso gravasse, o app escreveria em disco dezenas de
    // vezes por lançamento.
    await agir({ tipo: 'ABRIR_NOVA' });
    await agir({ tipo: 'DIGITO', valor: '5' });
    await agir({ tipo: 'DIGITO', valor: '0' });
    await agir({ tipo: 'IR_PARA', tela: 'extrato' });
    await agir({ tipo: 'FILTRO_CONTA', conta: 'cartao' });

    expect(chamadas).toHaveLength(0);
  });

  it('preferência é persistida, mesmo sem mexer em entidade', async () => {
    const { repo, chamadas } = repositorioEspiao();
    const { agir } = await montar(repo);

    await agir({ tipo: 'ALTERNAR_SALDO' });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].depois.mostrarSaldo).toBe(false);
  });

  it('grava uma vez por mudança, não uma por render', async () => {
    const { repo, chamadas } = repositorioEspiao();
    const { agir } = await montar(repo);

    await agir({ tipo: 'REGISTRO_RAPIDO', categoriaId: 'mercado', valorCentavos: 1000 });
    await agir({ tipo: 'REGISTRO_RAPIDO', categoriaId: 'lazer', valorCentavos: 2000 });

    expect(chamadas).toHaveLength(2);
  });

  it('o diff parte sempre do último estado gravado', async () => {
    const { repo, chamadas } = repositorioEspiao();
    const { agir } = await montar(repo);

    await agir({ tipo: 'REGISTRO_RAPIDO', categoriaId: 'mercado', valorCentavos: 1000 });
    await agir({ tipo: 'REGISTRO_RAPIDO', categoriaId: 'lazer', valorCentavos: 2000 });

    expect(chamadas[1].antes!.transacoes).toBe(chamadas[0].depois.transacoes);
  });

  it('falha ao gravar não derruba a tela e avisa quem pediu', async () => {
    const { repo, falharUmaVez } = repositorioEspiao();
    const avisos: unknown[] = [];
    const { agir, tela } = await montar(repo, (e) => avisos.push(e));

    falharUmaVez(new Error('disco cheio'));
    await agir({ tipo: 'REGISTRO_RAPIDO', categoriaId: 'mercado', valorCentavos: 1000 });

    expect(avisos).toHaveLength(1);
    // A transação continua no estado — o usuário não perde o que registrou.
    expect(tela.getByText('15')).toBeTruthy();
  });

  it('depois de falhar, a próxima gravação reenvia o que se perdeu', async () => {
    const { repo, chamadas, falharUmaVez } = repositorioEspiao();
    const { agir } = await montar(repo, () => {});

    falharUmaVez(new Error('disco cheio'));
    await agir({ tipo: 'REGISTRO_RAPIDO', categoriaId: 'mercado', valorCentavos: 1000 });
    expect(chamadas).toHaveLength(0);

    await agir({ tipo: 'REGISTRO_RAPIDO', categoriaId: 'lazer', valorCentavos: 2000 });

    // O diff da segunda escrita parte de antes da falha, então leva as DUAS.
    expect(chamadas).toHaveLength(1);
    const salvos = chamadas[0].depois.transacoes.length - chamadas[0].antes!.transacoes.length;
    expect(salvos).toBe(2);
  });

  it('sem repositório, o app funciona e não tenta gravar', async () => {
    const { agir, tela } = await montar(null);
    await agir({ tipo: 'REGISTRO_RAPIDO', categoriaId: 'mercado', valorCentavos: 1000 });
    expect(tela.getByText('15')).toBeTruthy();
  });

  it('o que chega ao repositório é o recorte, sem estado de sessão', async () => {
    const { repo, chamadas } = repositorioEspiao();
    const { agir } = await montar(repo);

    await agir({ tipo: 'REGISTRO_RAPIDO', categoriaId: 'mercado', valorCentavos: 1000 });

    const gravado = chamadas[0].depois as Record<string, unknown>;
    for (const chave of ['tela', 'folha', 'rascunho', 'toast', 'hoje', 'seq', 'filtroConta']) {
      expect(gravado[chave]).toBeUndefined();
    }
  });
});
