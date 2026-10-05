import { AGORA } from '../../dominio/datas';
import { mensagemParaOUsuario } from '../../dominio/erros';
import { Transacao } from '../../dominio/tipos';
import {
  Acao,
  criarEstadoDemo,
  criarReducer,
  dependenciasDeTeste,
  Estado,
  estadoInicial,
  estadoVazio,
} from '../../estado/store';
import { BackupInvalido, gerarBackup, lerBackup, nomeDoBackup, VERSAO_BACKUP } from '../backup';
import { EstadoPersistido, recortePersistido } from '../persistido';

/**
 * Backup em JSON.
 *
 * O app é só local: o arquivo é a única coisa entre a pessoa e perder o
 * histórico inteiro ao trocar de celular. Dois riscos, e um bloco de testes
 * para cada — o backup perder campo na ida e volta, e um arquivo ruim entrar
 * no estado e só estourar no banco.
 */

function aplicar(estado: Estado, ...acoes: Acao[]): Estado {
  return acoes.reduce(criarReducer(dependenciasDeTeste()), estado);
}

/**
 * A demo com o que ela não tem: linha importada, um par de transferência e uma
 * conta que lembra de qual conta do banco vêm os extratos dela.
 */
function completo(): EstadoPersistido {
  const guardado = aplicar(
    { ...estadoInicial, rascunho: { ...estadoInicial.rascunho, contaId: 'corrente' } },
    { tipo: 'ABRIR_MOVIMENTO_META', metaId: 'reserva' },
    { tipo: 'DEFINIR_DIGITOS', digitos: '10000' },
    { tipo: 'CONFIRMAR_MOVIMENTO_META' },
  );
  const importada: Transacao = {
    ...guardado.transacoes[0],
    id: 'importada',
    origem: 'ofx',
    idExterno: 'FITID-1',
    descricaoOriginal: 'PAG*PADARIA SAO JOAO',
  };
  return recortePersistido({
    ...guardado,
    transacoes: [importada, ...guardado.transacoes],
    contas: guardado.contas.map((c) => (c.id === 'cartao' ? { ...c, idNoBanco: '260:abc' } : c)),
    decisoesDeRecorrencia: [{ id: 'streamingbr', decisao: 'confirmada' }],
  });
}

/** Gera um backup, mexe no conteúdo e devolve o texto. */
function adulterado(mexer: (d: EstadoPersistido) => unknown): string {
  const arquivo = JSON.parse(gerarBackup(completo(), 0));
  return JSON.stringify({ ...arquivo, dados: mexer(arquivo.dados) });
}

const recusa = (texto: string) => {
  try {
    lerBackup(texto);
  } catch (erro) {
    expect(erro).toBeInstanceOf(BackupInvalido);
    return mensagemParaOUsuario(erro);
  }
  throw new Error('o backup deveria ter sido recusado');
};

describe('ida e volta', () => {
  it('nada se perde', () => {
    // O esquema descarta chave que não conhece. Campo novo no domínio que
    // ninguém pôs em `backup.ts` sumiria em silêncio no primeiro restaurar.
    const dados = completo();
    expect(lerBackup(gerarBackup(dados, 0))).toEqual({ ...dados, ultimoBackupEm: 0 });
  });

  it('o app vazio também volta', () => {
    const dados = recortePersistido(criarEstadoDemo(AGORA));
    expect(lerBackup(gerarBackup(dados, 0))).toEqual({ ...dados, ultimoBackupEm: 0 });
  });

  it('o último backup passa a ser o próprio arquivo, não o que ele trazia dentro', () => {
    // Gerado antes de o app saber que foi exportado, o arquivo carrega o
    // backup ANTERIOR. Tudo o que ele restaura já está guardado nele.
    const dados = { ...completo(), ultimoBackupEm: 1_000 };
    const geradoEm = Date.UTC(2026, 9, 2, 15);
    expect(lerBackup(gerarBackup(dados, geradoEm)).ultimoBackupEm).toBe(geradoEm);
  });

  it('backup de antes da recorrência ainda é lido, com tudo voltando a ser sugestão', () => {
    const texto = adulterado(({ decisoesDeRecorrencia: _, ...resto }) => resto);
    expect(lerBackup(texto).decisoesDeRecorrencia).toEqual([]);
  });

  it('backup de antes do lembrete, sem o campo, ainda é lido', () => {
    const texto = adulterado(({ ultimoBackupEm: _, ...resto }) => resto);
    expect(lerBackup(texto).ultimoBackupEm).toBe(0);
  });

  it('o arquivo diz o que é, de qual versão e quando foi feito', () => {
    const arquivo = JSON.parse(gerarBackup(completo(), Date.UTC(2026, 7, 5, 12)));
    expect(arquivo).toMatchObject({
      formato: 'poupa-bloco-backup',
      versao: VERSAO_BACKUP,
      geradoEm: '2026-08-05T12:00:00.000Z',
    });
  });

  it('o nome do arquivo leva a data, para ordenar na pasta', () => {
    expect(nomeDoBackup('2026-08-05')).toBe('poupa-bloco-2026-08-05.json');
  });

  it('categoria e meta que sumiram não são erro', () => {
    // Categoria órfã e entrada de meta apagada são caminhos normais do app.
    const texto = adulterado((d) => ({
      ...d,
      categorias: d.categorias.filter((c) => c.id !== 'mercado'),
      metas: [],
    }));
    expect(() => lerBackup(texto)).not.toThrow();
  });
});

describe('arquivo que não serve', () => {
  it('texto que não é JSON', () => {
    expect(recusa('isto não é json')).toBe('Este arquivo não é um backup do Poupa Bloco.');
  });

  it('JSON de outra coisa', () => {
    expect(recusa(JSON.stringify({ transacoes: [] }))).toBe(
      'Este arquivo não é um backup do Poupa Bloco.',
    );
  });

  it('backup de uma versão mais nova do app', () => {
    // Ler pela metade restauraria dado faltando sem ninguém perceber.
    const arquivo = JSON.parse(gerarBackup(completo(), 0));
    expect(recusa(JSON.stringify({ ...arquivo, versao: VERSAO_BACKUP + 1 }))).toContain(
      'versão mais nova',
    );
  });

  it('dinheiro em float', () => {
    const texto = adulterado((d) => ({
      ...d,
      transacoes: d.transacoes.map((t, i) => (i === 0 ? { ...t, valorCentavos: 287.9 } : t)),
    }));
    expect(recusa(texto)).toBe('O backup está incompleto ou foi alterado.');
  });

  it('data fora do formato', () => {
    const texto = adulterado((d) => ({
      ...d,
      transacoes: d.transacoes.map((t, i) => (i === 0 ? { ...t, ocorridoEm: '05/08/2026' } : t)),
    }));
    expect(recusa(texto)).toBe('O backup está incompleto ou foi alterado.');
  });

  it('sem nenhuma conta', () => {
    expect(recusa(adulterado((d) => ({ ...d, contas: [], transacoes: [], metas: [] })))).toBe(
      'O backup está incompleto ou foi alterado.',
    );
  });

  it('lançamento de uma conta que não está no arquivo', () => {
    // Passaria pelo reducer e sairia de todo saldo.
    const texto = adulterado((d) => ({
      ...d,
      transacoes: d.transacoes.map((t, i) => (i === 0 ? { ...t, contaId: 'sumiu' } : t)),
    }));
    expect(recusa(texto)).toContain('conta que não está nele');
  });

  it('id repetido', () => {
    const texto = adulterado((d) => ({ ...d, transacoes: [...d.transacoes, d.transacoes[0]] }));
    expect(recusa(texto)).toBe('O backup tem registros repetidos.');
  });

  it('o mesmo FITID duas vezes na mesma conta', () => {
    // O índice `(conta_id, id_externo)` do banco recusaria a segunda linha, e
    // ela viveria só na memória até fechar o app.
    const texto = adulterado((d) => ({
      ...d,
      transacoes: [...d.transacoes, { ...d.transacoes[0], id: 'outra' }],
    }));
    expect(recusa(texto)).toContain('duplicata');
  });
});

describe('restaurar', () => {
  const dados = completo();

  it('troca todo o dado do usuário pelo do arquivo', () => {
    const depois = aplicar(estadoInicial, { tipo: 'IMPORTAR_BACKUP', dados });
    expect(recortePersistido(depois)).toEqual(dados);
    expect(depois.toast!.texto).toBe('Backup restaurado');
  });

  it('do primeiro uso, entra direto no app', () => {
    const depois = aplicar(estadoVazio, {
      tipo: 'IMPORTAR_BACKUP',
      dados: { ...dados, onboardingConcluido: false },
    });
    expect(depois.onboardingConcluido).toBe(true);
    expect(depois.perfil).toEqual(dados.perfil);
  });

  it('o rascunho aponta para o que existe no backup', () => {
    const depois = aplicar(estadoVazio, { tipo: 'IMPORTAR_BACKUP', dados });
    expect(dados.contas.some((c) => c.id === depois.rascunho.contaId)).toBe(true);
    expect(dados.categorias.some((c) => c.id === depois.rascunho.categoriaId)).toBe(true);
  });

  it('é desfazível por cima de dados que já existiam', () => {
    const base = aplicar(estadoInicial, { tipo: 'APAGAR_DADOS' });
    const depois = aplicar(base, { tipo: 'IMPORTAR_BACKUP', dados });
    const desfeito = aplicar(depois, depois.toast!.acao!.acao);

    expect(recortePersistido(desfeito)).toEqual(recortePersistido(base));
    expect(desfeito.toast!.texto).toBe('Backup desfeito');
  });

  it('do primeiro uso não oferece desfazer', () => {
    // O estado de antes nunca foi gravado: voltar a ele deixaria o disco com o
    // backup e a tela no onboarding.
    const depois = aplicar(estadoVazio, { tipo: 'IMPORTAR_BACKUP', dados });
    expect(depois.toast!.acao).toBeUndefined();
  });
});
