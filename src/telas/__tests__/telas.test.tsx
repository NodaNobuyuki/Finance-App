import { render } from '@testing-library/react-native';
import React from 'react';
import { ICONE_ORFA } from '../../dominio/categorias';
import { hojeReal, inicioDaSemana } from '../../dominio/datas';
import { Tela } from '../../dominio/tipos';
import {
  Acao,
  criarEstadoDemo,
  criarReducer,
  dependenciasDeTeste,
  Estado,
  estadoInicial,
  estadoVazio,
  LojaProvider,
} from '../../estado/store';
import { PaletaId, paletas } from '../../tema/paletas';
import { TemaProvider } from '../../tema/TemaContext';
import { Categorias } from '../Categorias';
import { Extrato } from '../Extrato';
import { FecharSemana } from '../FecharSemana';
import { Habitos } from '../Habitos';
import { Inicio } from '../Inicio';
import { Lote } from '../Lote';
import { Metas } from '../Metas';
import { Onboarding } from '../Onboarding';
import { Recorrentes } from '../Recorrentes';
import { Resumo } from '../Resumo';
import { Simulador } from '../Simulador';
import { CadastroCategoria } from '../folhas/CadastroCategoria';
import { CadastroConta } from '../folhas/CadastroConta';
import { CadastroMeta } from '../folhas/CadastroMeta';
import { DetalheTransferencia } from '../folhas/DetalheTransferencia';
import { ImportarExtrato } from '../folhas/ImportarExtrato';
import { adapterOFX } from '../../ingestao/adapters/ofx';
import { decodificar } from '../../ingestao/texto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MovimentoMeta } from '../folhas/MovimentoMeta';
import { NovaTransacao } from '../folhas/NovaTransacao';
import { Ritual } from '../folhas/Ritual';
import { Transferencia } from '../folhas/Transferencia';

async function montar(no: React.ReactNode, estado: Estado = estadoInicial, paleta?: PaletaId) {
  return render(
    <TemaProvider inicial={paleta}>
      <LojaProvider inicial={estado}>{no}</LojaProvider>
    </TemaProvider>,
  );
}

const TELAS: {
  nome: Tela | string;
  no: React.ReactNode;
  texto: string;
  /** Âncora quando não há dado — a Home cumprimenta sem nome. */
  textoVazio?: string;
}[] = [
  { nome: 'home', no: <Inicio />, texto: 'Olá, Marina', textoVazio: 'Olá' },
  { nome: 'extrato', no: <Extrato />, texto: 'Extrato' },
  { nome: 'metas', no: <Metas />, texto: 'Metas' },
  { nome: 'categorias', no: <Categorias />, texto: 'Categorias' },
  { nome: 'habitos', no: <Habitos />, texto: 'Hábitos' },
  { nome: 'simulador', no: <Simulador />, texto: 'Vale a pena?' },
  { nome: 'lote', no: <Lote />, texto: 'Colocar em dia' },
  { nome: 'resumo', no: <Resumo />, texto: 'Resumo da semana' },
  { nome: 'fechar', no: <FecharSemana />, texto: 'Fechar a semana' },
  { nome: 'recorrentes', no: <Recorrentes />, texto: 'Recorrentes' },
  { nome: 'nova transação', no: <NovaTransacao />, texto: 'Nova transação' },
  {
    nome: 'guardar na meta',
    no: <MovimentoMeta metaId="reserva" retirar={false} />,
    texto: 'Adicionar à meta',
  },
  {
    nome: 'retirar da meta',
    no: <MovimentoMeta metaId="reserva" retirar />,
    texto: 'Retirar da meta',
  },
  { nome: 'transferência', no: <Transferencia />, texto: 'Transferir' },
  { nome: 'ritual', no: <Ritual />, texto: 'Seu ritual' },
  { nome: 'nova conta', no: <CadastroConta />, texto: 'Nova conta' },
  { nome: 'nova meta', no: <CadastroMeta />, texto: 'Nova meta' },
  { nome: 'nova categoria', no: <CadastroCategoria />, texto: 'Nova categoria' },
];

describe('renderização das telas', () => {
  it.each(TELAS)('$nome monta sem erro', async ({ no, texto }) => {
    const tela = await montar(no);
    expect(tela.getByText(texto)).toBeTruthy();
  });
});

describe('todas as paletas', () => {
  // Se alguma tela lê um token que a paleta não define, isto quebra.
  it.each(Object.keys(paletas) as PaletaId[])('%s renderiza a Home', async (id) => {
    const tela = await montar(<Inicio />, estadoInicial, id);
    expect(tela.getByText('Olá, Marina')).toBeTruthy();
  });
});

describe('relógio real', () => {
  // É este o caminho que o app roda de verdade desde que `AGORA` deixou de ser
  // o padrão. O resto da suíte usa a âncora fixa, então sem isto a data real
  // ficaria sem nenhuma cobertura — que é justamente onde mora o risco.
  it.each(TELAS)('$nome monta no dia de hoje', async ({ no, texto }) => {
    const tela = await montar(no, criarEstadoDemo(hojeReal()));
    expect(tela.getByText(texto)).toBeTruthy();
  });
});

describe('app vazio', () => {
  // Nunca tinham sido exercitadas: até a persistência entrar, sempre havia
  // seed. É aqui que aparece tela que só sabe existir com dado dentro.
  it.each(TELAS)('$nome monta sem dado nenhum', async ({ no, texto, textoVazio }) => {
    const tela = await montar(no, estadoVazio);
    expect(tela.getByText(textoVazio ?? texto)).toBeTruthy();
  });

  it('a Home cumprimenta sem nome, sem inventar um', async () => {
    const tela = await montar(<Inicio />, estadoVazio);
    expect(tela.getByText('Olá')).toBeTruthy();
    expect(tela.queryByText('Olá, Marina')).toBeNull();
  });

  it('a Home convida a registrar em vez de mostrar lista vazia', async () => {
    const tela = await montar(<Inicio />, estadoVazio);
    expect(tela.getByText('Nenhum lançamento ainda')).toBeTruthy();
  });

  it('o Extrato distingue vazio de mês vazio de filtro sem resultado', async () => {
    // Três situações, três saídas. Dizer "nenhuma transação com esses filtros"
    // para quem só navegou até um mês em branco mandaria mexer no lugar errado.
    const semNada = await montar(<Extrato />, estadoVazio);
    expect(semNada.getByText('Seu extrato começa aqui')).toBeTruthy();

    const mesVazio = await montar(<Extrato />, { ...estadoInicial, mesVisivel: '2026-05-01' });
    expect(mesVazio.getByText('Nada em Maio 2026')).toBeTruthy();

    const comFiltro = await montar(<Extrato />, { ...estadoInicial, filtroCategoria: 'presente' });
    expect(comFiltro.getByText('Nenhuma transação com esses filtros')).toBeTruthy();
  });

  it('editar um lançamento abre a mesma folha, preenchida e com apagar', async () => {
    const despesa = estadoInicial.transacoes.find(
      (t) => t.valorCentavos < 0 && t.transferenciaId === undefined,
    )!;
    const aberto = criarReducer(dependenciasDeTeste())(estadoInicial, {
      tipo: 'ABRIR_LANCAMENTO',
      transacaoId: despesa.id,
    });
    const tela = await montar(<NovaTransacao />, aberto);

    expect(tela.getByText('Editar lançamento')).toBeTruthy();
    expect(tela.getByText('Salvar alterações')).toBeTruthy();
    expect(tela.getByText('Apagar lançamento')).toBeTruthy();
    // O tipo vem do SINAL: despesa oferece só categorias de despesa.
    expect(tela.getByText('Mercado')).toBeTruthy();
    expect(tela.queryByText('Salário')).toBeNull();
    // Corrigir um gasto antigo não é hora de simular se valia a pena.
    expect(tela.queryByText('Vale a pena? Simular')).toBeNull();
  });

  it('o lançamento novo oferece atalhos de data, sem apagar', async () => {
    const tela = await montar(<NovaTransacao />, estadoInicial);

    expect(tela.getByText('Hoje')).toBeTruthy();
    expect(tela.getByText('Ontem')).toBeTruthy();
    expect(tela.queryByText('Apagar lançamento')).toBeNull();
  });

  it('o detalhe de uma transferência mostra as duas pontas e deixa apagar', async () => {
    const guardar: Acao[] = [
      { tipo: 'ABRIR_MOVIMENTO_META', metaId: 'reserva' },
      { tipo: 'DEFINIR_DIGITOS', digitos: '10000' },
      { tipo: 'CONFIRMAR_MOVIMENTO_META' },
    ];
    const guardado = guardar.reduce(criarReducer(dependenciasDeTeste()), {
      ...estadoInicial,
      rascunho: { ...estadoInicial.rascunho, contaId: 'corrente' },
    });
    const ponta = guardado.transacoes.find((t) => t.transferenciaId !== undefined)!;
    const tela = await montar(
      <DetalheTransferencia transferenciaId={ponta.transferenciaId!} />,
      guardado,
    );

    expect(tela.getByText('R$ 100,00')).toBeTruthy();
    expect(tela.getByText('De Conta corrente para Poupança')).toBeTruthy();
    expect(tela.getByText('Apagar movimento')).toBeTruthy();
  });

  it('o Extrato desenha só o começo de um mês cheio, não o mês inteiro', async () => {
    // A lista é virtualizada: um mês com centenas de lançamentos não pode virar
    // centenas de linhas montadas de uma vez. Se isto quebrar, alguém trocou o
    // SectionList por um map de novo.
    const base = estadoInicial.transacoes[0];
    const cheio: Estado = {
      ...estadoInicial,
      transacoes: Array.from({ length: 300 }, (_, i) => ({
        ...base,
        id: `cheio-${i}`,
        descricao: 'Linha de teste',
        ocorridoEm: `2026-08-0${(i % 5) + 1}`,
      })),
    };
    const tela = await montar(<Extrato />, cheio);

    const desenhadas = tela.queryAllByText('Linha de teste').length;
    expect(desenhadas).toBeGreaterThan(0);
    expect(desenhadas).toBeLessThan(300);
  });

  it('o Extrato mostra o mês visível no cabeçalho, não o dia de hoje', async () => {
    const julho = await montar(<Extrato />, { ...estadoInicial, mesVisivel: '2026-07-01' });
    expect(julho.getByText('Julho 2026')).toBeTruthy();
  });

  it('o backup está ao alcance: exportar em Hábitos, restaurar no primeiro uso', async () => {
    // Num app só local, o arquivo é o que separa trocar de celular de perder
    // o histórico — e quem chega num celular novo começa pelo onboarding.
    const habitos = await montar(<Habitos />, estadoInicial);
    expect(habitos.getByText('Exportar backup')).toBeTruthy();
    expect(habitos.getByText('Restaurar backup')).toBeTruthy();

    const primeiroUso = await montar(<Onboarding />, estadoVazio);
    expect(primeiroUso.getByText('Restaurar backup')).toBeTruthy();
  });

  it('Recorrentes vazio explica de onde elas vêm e oferece importar', async () => {
    const tela = await montar(<Recorrentes />, estadoVazio);
    expect(tela.getByText('Nenhum gasto repetido ainda')).toBeTruthy();
    expect(tela.getByText('Importar extrato')).toBeTruthy();
  });

  it('a recorrência sugerida pede decisão; a confirmada vencida oferece lançar, também na Home', async () => {
    const mes = (dia: string, id: string) => ({
      ...estadoInicial.transacoes[0],
      id,
      valorCentavos: -4490,
      ocorridoEm: dia,
      descricao: 'Streamingbr',
      descricaoOriginal: 'Streamingbr',
    });
    const comHistorico: Estado = {
      ...estadoInicial,
      hoje: '2026-10-16',
      transacoes: [mes('2026-08-15', 'a'), mes('2026-09-15', 'b')],
    };

    const sugerida = await montar(<Recorrentes />, comHistorico);
    expect(sugerida.getByText('É recorrente')).toBeTruthy();
    const homeSugerida = await montar(<Inicio />, comHistorico);
    expect(homeSugerida.getByText('1 gasto parece se repetir todo mês')).toBeTruthy();

    const confirmada: Estado = {
      ...comHistorico,
      decisoesDeRecorrencia: [{ id: 'streamingbr', decisao: 'confirmada' }],
    };
    const tela = await montar(<Recorrentes />, confirmada);
    expect(tela.getByText('Lançar')).toBeTruthy();
    const home = await montar(<Inicio />, confirmada);
    expect(home.getByText('Venceu')).toBeTruthy();
    expect(home.getByLabelText('Lançar Streamingbr')).toBeTruthy();
  });

  it('a Home avisa do backup só quando há o que perder', async () => {
    const semBackup = await montar(<Inicio />, estadoInicial);
    expect(semBackup.getByText('Nenhum backup ainda')).toBeTruthy();
    expect(semBackup.getByText('Fazer backup')).toBeTruthy();

    const emDia = await montar(<Inicio />, { ...estadoInicial, ultimoBackupEm: Date.now() });
    expect(emDia.queryByText('Fazer backup')).toBeNull();

    const vazio = await montar(<Inicio />, estadoVazio);
    expect(vazio.queryByText('Fazer backup')).toBeNull();

    const habitos = await montar(<Habitos />, estadoInicial);
    expect(habitos.getByText('Nenhum backup feito ainda.')).toBeTruthy();
  });

  it('a prévia de importação mostra o extrato, a conta e as transferências', async () => {
    const bytes = new Uint8Array(
      readFileSync(join(__dirname, '../../ingestao/__tests__/fixtures/nubank-cartao.ofx')),
    );
    const extrato = adapterOFX.ler(decodificar(bytes));
    const aberto = criarReducer(dependenciasDeTeste())(estadoInicial, {
      tipo: 'ABRIR_IMPORTACAO',
      extrato,
    });
    const tela = await montar(<ImportarExtrato />, aberto);

    expect(tela.getByText('Importar extrato')).toBeTruthy();
    expect(tela.getByText('Fatura de cartão · NU PAGAMENTOS S.A.')).toBeTruthy();
    expect(tela.getByText('Importar 16 lançamentos')).toBeTruthy();
    // A lista é virtualizada: o segundo pagamento (linha 14) nem é desenhado
    // de saída. Basta o primeiro, que está no começo da fatura.
    expect(tela.getAllByText('Não é transferência').length).toBeGreaterThan(0);
  });

  it('o Extrato oferece importar', async () => {
    const tela = await montar(<Extrato />, estadoInicial);
    expect(tela.getByText('Importar')).toBeTruthy();
  });

  it('Metas vazio explica para que serve uma meta', async () => {
    const tela = await montar(<Metas />, estadoVazio);
    expect(tela.getByText('Nenhuma meta ainda')).toBeTruthy();
  });

  it('a Home não anuncia orçamento que ninguém definiu', async () => {
    // `0% usado · R$ 0,00 de R$ 0,00`, sempre verde, era o que toda instalação
    // nova via: o teto era um campo da semente que nenhuma ação escrevia. Agora
    // ele é a soma dos tetos das categorias, e sem nenhum a Home convida a
    // definir o primeiro em vez de mostrar uma barra vazia.
    const tela = await montar(<Inicio />, estadoVazio);
    expect(tela.getByText('Definir orçamento')).toBeTruthy();
    expect(tela.queryByText('0% usado')).toBeNull();
    expect(tela.queryByText('Orçamento do mês')).toBeNull();
  });

  it('Categorias oferece o caminho do primeiro teto', async () => {
    const tela = await montar(<Categorias />, estadoVazio);
    expect(tela.getByText(/ainda não definiu teto nenhum/)).toBeTruthy();
  });

  it('a Home não anuncia constância que não existe', async () => {
    const tela = await montar(<Inicio />, estadoVazio);
    expect(tela.queryByText(/semanas seguidas em dia/)).toBeNull();
  });

  it('o onboarding abre no passo 1', async () => {
    const tela = await montar(<Onboarding />, estadoVazio);
    expect(tela.getByText('Como podemos te chamar?')).toBeTruthy();
  });
});

describe('estados-limite', () => {
  it('Início funciona com a semana já fechada', async () => {
    const tela = await montar(<Inicio />, {
      ...estadoInicial,
      semanaFechada: inicioDaSemana(estadoInicial.hoje),
    });
    expect(tela.getByText('Semana fechada')).toBeTruthy();
  });

  it('Resumo aguenta uma semana sem nenhuma transação', async () => {
    const tela = await montar(<Resumo />, { ...estadoInicial, transacoes: [] });
    expect(tela.getByText('Resumo da semana')).toBeTruthy();
  });

  it('Lote aguenta não ter nenhum dia em aberto', async () => {
    const tela = await montar(<Lote />, {
      ...estadoInicial,
      diasSemGasto: ['2026-08-04', '2026-08-05'],
    });
    expect(tela.getByText('Colocar em dia')).toBeTruthy();
  });

  it('Fechar semana mostra o passo 3', async () => {
    const tela = await montar(<FecharSemana />, {
      ...estadoInicial,
      fecharPasso: 3,
      fechando: true,
    });
    expect(tela.getByText('Um foco para a próxima')).toBeTruthy();
  });
});

/**
 * O terceiro estado: quem tem vocabulário próprio.
 *
 * A suíte montava tudo contra a demo e contra o app vazio, e as duas trazem os
 * ids de fábrica — então id de semente cravado em tela passava verde. Foi
 * assim que `'reserva'` sobreviveu no Simulador e a lista de cinco categorias
 * sobreviveu no Lote: **na demo elas existem.**
 *
 * Aqui todo id de categoria, meta e conta é reescrito para um que o catálogo
 * não conhece, com as transações remapeadas junto — é o que acontece de
 * verdade, onde tudo nasce de UUID. Qualquer tela que dependa de um id fixo
 * passa a mostrar buraco.
 */
const NOVO_ID = (id: string) => `u-${id}`;

type No = { props?: Record<string, unknown>; children?: (No | string)[] | null };

/**
 * Todo `d` de `Path` renderizado. Percorre só os filhos: as props de lista
 * virtualizada carregam referência circular e `JSON.stringify` não passa.
 */
function desenhos(raiz: unknown): string[] {
  const achados: string[] = [];
  const visitar = (no: No | string | null) => {
    if (no === null || typeof no === 'string') return;
    if (typeof no.props?.d === 'string') achados.push(no.props.d);
    no.children?.forEach(visitar);
  };
  (Array.isArray(raiz) ? raiz : [raiz]).forEach(visitar);
  return achados;
}

function comVocabularioProprio(base: Estado): Estado {
  return {
    ...base,
    categorias: base.categorias.map((c) => ({ ...c, id: NOVO_ID(c.id) })),
    contas: base.contas.map((c) => ({ ...c, id: NOVO_ID(c.id) })),
    metas: base.metas.map((m) => ({ ...m, id: NOVO_ID(m.id), contaId: NOVO_ID(m.contaId) })),
    transacoes: base.transacoes.map((t) => ({
      ...t,
      categoriaId: NOVO_ID(t.categoriaId),
      contaId: NOVO_ID(t.contaId),
      metaId: t.metaId === undefined ? undefined : NOVO_ID(t.metaId),
    })),
    rascunho: {
      ...base.rascunho,
      categoriaId: NOVO_ID(base.rascunho.categoriaId),
      contaId: NOVO_ID(base.rascunho.contaId),
    },
    transferenciaDestinoId: NOVO_ID(base.transferenciaDestinoId),
  };
}

describe('vocabulário próprio do usuário', () => {
  const proprio = comVocabularioProprio(estadoInicial);

  // `MovimentoMeta` recebe o id por prop, então acompanha o remapeamento.
  const TELAS_PROPRIAS = TELAS.map((tela) =>
    tela.nome === 'guardar na meta'
      ? { ...tela, no: <MovimentoMeta metaId={NOVO_ID('reserva')} retirar={false} /> }
      : tela.nome === 'retirar da meta'
        ? { ...tela, no: <MovimentoMeta metaId={NOVO_ID('reserva')} retirar /> }
        : tela,
  );

  it.each(TELAS_PROPRIAS)(
    '$nome monta com ids que não são os de fábrica',
    async ({ no, texto }) => {
      const tela = await montar(no, proprio);
      expect(tela.getByText(texto)).toBeTruthy();
    },
  );

  it.each(TELAS_PROPRIAS)('$nome não mostra buraco de categoria', async ({ no }) => {
    // "Sem categoria" é o placeholder de `categoriaOrfa`. Com todas as
    // categorias válidas e todas as transações apontando para elas, ele não
    // pode aparecer em tela nenhuma: se aparecer, alguém cravou um id.
    const tela = await montar(no, proprio);
    expect(tela.queryByText('Sem categoria')).toBeNull();
    // Id cravado que só pinta ícone e cor não escreve "Sem categoria" — foi
    // assim que o catálogo de desafios passou pelo guarda de texto. O desenho
    // do buraco na árvore denuncia do mesmo jeito.
    expect(desenhos(tela.toJSON())).not.toContain(ICONE_ORFA);
  });

  it('o Lote oferece as categorias da pessoa, não as de fábrica', async () => {
    // O caso concreto: a tela trazia
    // `['mercado', 'restaurante', 'transporte', 'casa', 'lazer']` cravado.
    const tela = await montar(<Lote />, proprio);
    const nomes = proprio.categorias.filter((c) => c.tipo === 'despesa').map((c) => c.nome);
    expect(nomes.some((nome) => tela.queryAllByText(nome).length > 0)).toBe(true);
  });
});
