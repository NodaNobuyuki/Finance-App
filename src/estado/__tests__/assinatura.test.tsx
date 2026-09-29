import { act, render } from '@testing-library/react-native';
import React, { Profiler } from 'react';
import { Text } from 'react-native';
import { TemaProvider } from '../../tema/TemaContext';
import { Extrato } from '../../telas/Extrato';
import { Inicio } from '../../telas/Inicio';
import { NovaTransacao } from '../../telas/folhas/NovaTransacao';
import {
  Acao,
  estadoInicial,
  igualRaso,
  LojaProvider,
  useDespachar,
  useRecorte,
  useSeletor,
} from '../store';

/**
 * Quem re-renderiza quando o estado muda.
 *
 * Com o `Estado` inteiro no contexto, cada tecla do teclado numérico — que só
 * troca `rascunho` — re-renderizava a tela atrás da folha e cada linha do
 * Extrato. É o que estes testes travam, contando commits com `Profiler`: não
 * é tempo medido (isso aqui não diz nada sobre o aparelho), é o React
 * confirmando que nem chegou a chamar o componente.
 */

type Contagem = Record<string, number>;

async function montar(no: React.ReactNode) {
  const renders: Contagem = {};
  let despachar!: React.Dispatch<Acao>;

  function Sonda() {
    despachar = useDespachar();
    return null;
  }

  const contar = (id: string) => {
    renders[id] = (renders[id] ?? 0) + 1;
  };

  await render(
    <TemaProvider>
      <LojaProvider inicial={estadoInicial}>
        <Sonda />
        <Profiler id="tela" onRender={contar}>
          {no}
        </Profiler>
        <Profiler id="folha" onRender={contar}>
          <NovaTransacao />
        </Profiler>
      </LojaProvider>
    </TemaProvider>,
  );
  // Deixa assentar o que a montagem dispara sozinha — a resposta de "reduzir
  // movimento" do sistema chega depois e re-renderiza a folha uma vez. Contar a
  // partir daqui é contar só o que as ações causam.
  await act(async () => {});

  return {
    renders,
    agir: async (...acoes: Acao[]) => {
      for (const a of acoes) {
        await act(async () => {
          despachar(a);
        });
      }
    },
  };
}

const TECLAS: Acao[] = ['1', '2', '5', '0'].map((valor) => ({ tipo: 'DIGITO', valor }));

describe('digitar na folha acorda só a folha', () => {
  it.each([
    ['Início', <Inicio key="i" />],
    ['Extrato', <Extrato key="e" />],
  ])('%s, atrás da folha, não re-renderiza a cada tecla', async (_nome, tela) => {
    const { renders, agir } = await montar(tela);
    const antes = { ...renders };

    await agir(...TECLAS);

    // A folha andou — senão o teste passaria com o despacho quebrado. Não é
    // igualdade exata: a folha tem estado próprio e renderiza duas vezes na
    // primeira tecla; o que interessa aqui é a tela de trás.
    expect(renders.folha).toBeGreaterThanOrEqual(antes.folha + TECLAS.length);
    expect(renders.tela).toBe(antes.tela);
  });

  it('registrar um gasto ainda acorda a tela de trás', async () => {
    // O outro lado: recorte que nunca muda também passaria no teste acima.
    const { renders, agir } = await montar(<Inicio />);
    const antes = renders.tela;

    await agir({ tipo: 'REGISTRO_RAPIDO', categoriaId: 'mercado', valorCentavos: 1000 });

    expect(renders.tela).toBeGreaterThan(antes);
  });
});

describe('useSeletor', () => {
  it('seletor escrito inline não re-renderiza quando o valor é o mesmo', async () => {
    let renders = 0;
    let despachar!: React.Dispatch<Acao>;

    function Nome() {
      renders += 1;
      despachar = useDespachar();
      // Função nova a cada render, como qualquer componente escreveria.
      const nome = useSeletor((e) => e.perfil.nome);
      return <Text>{nome}</Text>;
    }

    const tela = await render(
      <LojaProvider inicial={estadoInicial}>
        <Nome />
      </LojaProvider>,
    );
    const antes = renders;

    await act(async () => {
      despachar({ tipo: 'DIGITO', valor: '7' });
    });

    expect(renders).toBe(antes);
    expect(tela.getByText('Marina')).toBeTruthy();
  });

  it('ação que devolve o mesmo estado não acorda ninguém', async () => {
    let renders = 0;
    let despachar!: React.Dispatch<Acao>;

    function Tudo() {
      renders += 1;
      despachar = useDespachar();
      // Assina o estado inteiro de propósito: qualquer notificação acordaria.
      useSeletor((e) => e);
      return null;
    }

    await render(
      <LojaProvider inicial={estadoInicial}>
        <Tudo />
      </LojaProvider>,
    );
    const antes = renders;

    // Limpar um toast que não existe devolve `e` intacto no reducer.
    await act(async () => {
      despachar({ tipo: 'LIMPAR_TOAST', id: 999 });
    });

    expect(renders).toBe(antes);
  });

  it('useRecorte devolve só as chaves pedidas', async () => {
    let visto: object = {};

    function Recorte() {
      visto = useRecorte(['hoje', 'tela'] as const);
      return null;
    }

    await render(
      <LojaProvider inicial={estadoInicial}>
        <Recorte />
      </LojaProvider>,
    );

    expect(visto).toEqual({ hoje: estadoInicial.hoje, tela: estadoInicial.tela });
  });
});

describe('igualRaso', () => {
  const lista: number[] = [];

  it('compara valor por referência, chave a chave', () => {
    expect(igualRaso({ a: lista, b: 1 }, { a: lista, b: 1 })).toBe(true);
    // Mesmo conteúdo, outra lista: para o React, mudou.
    expect(igualRaso({ a: lista }, { a: [] as number[] })).toBe(false);
  });

  it('chave a mais ou a menos é diferença', () => {
    expect(igualRaso<object>({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});
