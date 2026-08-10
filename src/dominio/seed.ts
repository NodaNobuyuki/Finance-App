import { hex, token } from '../tema/paletas';
import { DiaISO, inicioDaSemana, somarDias } from './datas';
import { Aporte, Conta, Contexto, Meta, Perfil, ProgressoDesafio, Transacao } from './tipos';

/**
 * Dados de demonstração. Todos os valores já em centavos inteiros.
 *
 * Este módulo é a SEMENTE do estado, não uma fonte consultada em runtime:
 * quem lê daqui é `criarEstadoInicial`, em `src/estado/store.tsx`, e mais
 * ninguém. Tela, componente e derivado leem sempre de `estado.*`. Um
 * `no-restricted-imports` no ESLint segura essa regra.
 *
 * O motivo é persistência: o que não está em `Estado` não tem como ser gravado
 * nem recarregado. Enquanto contas, metas e desafios morarem neste arquivo,
 * eles são imutáveis por construção.
 *
 * As datas são RELATIVAS ao dia recebido, nunca fixas. Com o relógio real
 * ligado, semente de data cravada envelhece: em um mês a demo abre num mês sem
 * lançamento nenhum, mostrando a semana toda em aberto. `semente(AGORA)`
 * reproduz exatamente o fixture antigo, que é o que os testes travam.
 */

/**
 * `saldoInicialCentavos` é saldo de ABERTURA, não saldo atual.
 * O saldo exibido sai de `saldoDaConta()` somando as transações por cima —
 * é por isso que estes números não batem com o que a tela mostra.
 */
const contas: Conta[] = [
  {
    id: 'carteira',
    nome: 'Carteira',
    tipo: 'carteira',
    saldoInicialCentavos: 59320,
    cor: hex('#8a6d3b'),
  },
  {
    id: 'corrente',
    nome: 'Conta corrente',
    tipo: 'corrente',
    saldoInicialCentavos: 270575,
    cor: hex('#2f6f8f'),
  },
  {
    id: 'cartao',
    nome: 'Cartão',
    tipo: 'cartao',
    saldoInicialCentavos: -62090,
    cor: token('down'),
  },
  {
    id: 'poupanca',
    nome: 'Poupança',
    tipo: 'poupanca',
    saldoInicialCentavos: 462000,
    cor: token('up'),
  },
];

/**
 * Transações da demo, posicionadas por quantos dias atrás caem — nunca por
 * data absoluta. `atras` 2, 3 e 4 reproduzem 03, 02 e 01 de agosto quando
 * `hoje` é a âncora `AGORA`.
 */
function transacoesDemo(hoje: DiaISO): Transacao[] {
  let seq = 0;
  const tx = (
    atras: number,
    descricao: string,
    categoriaId: string,
    valorCentavos: number,
    contaId: string,
  ): Transacao => {
    seq += 1;
    return {
      id: `seed-${seq}`,
      contaId,
      categoriaId,
      valorCentavos,
      ocorridoEm: somarDias(hoje, -atras),
      descricao,
      descricaoOriginal: descricao,
      origem: 'manual',
      criadoEm: seq,
    };
  };

  return [
    tx(2, 'Mercado Extra', 'mercado', -28790, 'cartao'),
    tx(2, 'Café da manhã', 'restaurante', -1850, 'carteira'),
    tx(2, 'Uber para o centro', 'transporte', -2430, 'cartao'),
    tx(3, 'Freela — identidade visual', 'freela', 162000, 'corrente'),
    tx(3, 'Aluguel', 'casa', -185000, 'corrente'),
    tx(3, 'Conta de luz', 'contas', -21370, 'corrente'),
    tx(3, 'Netflix', 'assinaturas', -4490, 'cartao'),
    tx(3, 'Cinema', 'lazer', -7600, 'carteira'),
    tx(4, 'Salário do mês', 'salario', 680000, 'corrente'),
    tx(4, 'Posto Shell', 'transporte', -22000, 'cartao'),
    tx(4, 'Farmácia São Paulo', 'saude', -13240, 'cartao'),
    tx(4, 'Mercado Dia', 'mercado', -15820, 'carteira'),
    tx(4, 'Curso de inglês', 'educacao', -8990, 'cartao'),
    tx(4, 'Academia', 'saude', -11990, 'corrente'),
  ];
}

/**
 * Metas da demo. O prazo é um deslocamento em dias a partir de `hoje`, nunca
 * data cravada: ancorado em `AGORA`, reproduz 15/12/2026, jun/2027 e
 * 20/10/2026 do protótipo, e em qualquer outro dia continua no futuro.
 */
function metasDemo(hoje: DiaISO): Meta[] {
  return [
    {
      id: 'chile',
      nome: 'Viagem para o Chile',
      alvoCentavos: 800000,
      guardadoInicialCentavos: 320000,
      prazo: somarDias(hoje, 132),
      cor: hex('#2f6f8f'),
      icone: 'M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20',
    },
    {
      id: 'reserva',
      nome: 'Reserva de emergência',
      alvoCentavos: 1200000,
      guardadoInicialCentavos: 640000,
      prazo: somarDias(hoje, 314),
      cor: token('up'),
      icone: 'M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z',
    },
    {
      id: 'note',
      nome: 'Notebook novo',
      alvoCentavos: 450000,
      guardadoInicialCentavos: 285000,
      prazo: somarDias(hoje, 76),
      cor: token('accent'),
      icone: 'M4 5h16v10H4zM2 19h20M9 19l.6-2h4.8l.6 2',
    },
  ];
}

/**
 * Progresso de demonstração. Só faz sentido na demo: quem instala o app hoje
 * começa tudo em zero, e é a ausência de linha que faz valer o padrão do
 * catálogo (`progressoDe`).
 */
const progressoDesafios: ProgressoDesafio[] = [
  { id: 'catg', aceito: true, progresso: 12 },
  { id: 'assin', aceito: true, progresso: 1 },
];

/**
 * Dias em que a Marina declarou não ter gasto nada, nas 5 semanas anteriores.
 *
 * É daqui que sai a trilha de constância da demo. Antes ela vinha de um array
 * de contagens (`4, 4, 3, 4, 4`) que não correspondia a dado nenhum: a tela
 * anunciava registros que não existiam em lugar algum do estado. Agora a
 * trilha é derivada, então a demo precisa de registros de verdade.
 *
 * São dias sem gasto, e não transações, de propósito: "não gastei" conta como
 * registro sem mexer em dinheiro, e os saldos da demo estão cravados nos
 * valores do protótipo (ver `saldo.test.ts`).
 *
 * A progressão 2 → 3 → 4 → 4 → 3+ conta uma história de hábito sendo formado,
 * em vez de um platô que nenhuma pessoa real teria na primeira semana.
 */
function diasSemGastoDemo(hoje: DiaISO): DiaISO[] {
  const estaSemana = inicioDaSemana(hoje);
  // Por semana (da mais antiga à anterior), quais dias da semana foram
  // marcados — 0 = segunda. Só dias no começo da semana, porque as transações
  // da demo caem nos últimos dias e dia repetido não contaria duas vezes.
  const porSemana = [[0, 2], [0, 1, 3], [0, 1, 2, 3], [0, 1, 2, 4], [0, 2, 3]];

  return porSemana.flatMap((dias, i) => {
    const inicio = somarDias(estaSemana, -7 * (porSemana.length - i));
    return dias.map((d) => somarDias(inicio, d));
  });
}

/** Teto de gasto do mês. Vira `budgets.limit_cents` quando houver backend. */
const orcamentoMensalCentavos = 500000;

/** Números de contexto que ainda não saem das transações carregadas. */
const contexto: Contexto = {
  lancamentosMesAnterior: 18,
  economiaBaseCentavos: 18000,
};

/** O que a demo carrega, ancorado no dia recebido. */
export type Semente = {
  perfil: Perfil;
  contas: Conta[];
  transacoes: Transacao[];
  metas: Meta[];
  aportes: Aporte[];
  progressoDesafios: ProgressoDesafio[];
  diasSemGasto: DiaISO[];
  orcamentoMensalCentavos: number;
  contexto: Contexto;
};

export function semente(hoje: DiaISO): Semente {
  return {
    perfil: { nome: 'Marina' },
    contas,
    transacoes: transacoesDemo(hoje),
    metas: metasDemo(hoje),
    // Nenhum aporte de partida: o guardado de cada meta começa na abertura dela.
    aportes: [],
    progressoDesafios,
    diasSemGasto: diasSemGastoDemo(hoje),
    orcamentoMensalCentavos,
    contexto,
  };
}

/**
 * O que um app recém-instalado carrega: nada.
 *
 * Os números de contexto vão a zero de propósito. Eles são placeholders de
 * tela, e a demo os traz preenchidos — entregar "18 lançamentos no mês
 * anterior" para quem abriu o app agora é mentira, não é dado de partida.
 */
export function vazia(): Semente {
  return {
    perfil: { nome: '' },
    contas: [],
    transacoes: [],
    metas: [],
    aportes: [],
    progressoDesafios: [],
    diasSemGasto: [],
    orcamentoMensalCentavos: 0,
    contexto: { lancamentosMesAnterior: 0, economiaBaseCentavos: 0 },
  };
}
