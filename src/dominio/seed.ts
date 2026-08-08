import { hex, token } from '../tema/paletas';
import { Aporte, Conta, Contexto, Desafio, Meta, SemanaHistorica, Transacao } from './tipos';

/**
 * Dados de demonstração. Todos os valores já em centavos inteiros.
 *
 * Este módulo é a SEMENTE do estado, não uma fonte consultada em runtime:
 * quem lê daqui é `estadoInicial`, em `src/estado/store.tsx`, e mais ninguém.
 * Tela, componente e derivado leem sempre de `estado.*`. Um `no-restricted-imports`
 * no ESLint segura essa regra.
 *
 * O motivo é persistência: o que não está em `Estado` não tem como ser gravado
 * nem recarregado. Enquanto contas, metas e desafios morarem neste arquivo,
 * eles são imutáveis por construção.
 */

/**
 * `saldoInicialCentavos` é saldo de ABERTURA, não saldo atual.
 * O saldo exibido sai de `saldoDaConta()` somando as transações por cima —
 * é por isso que estes números não batem com o que a tela mostra.
 */
export const contas: Conta[] = [
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

let seq = 0;
function tx(
  ocorridoEm: string,
  descricao: string,
  categoriaId: string,
  valorCentavos: number,
  contaId: string,
): Transacao {
  seq += 1;
  return {
    id: `seed-${seq}`,
    contaId,
    categoriaId,
    valorCentavos,
    ocorridoEm,
    descricao,
    descricaoOriginal: descricao,
    origem: 'manual',
    criadoEm: seq,
  };
}

export const transacoes: Transacao[] = [
  tx('2026-08-03', 'Mercado Extra', 'mercado', -28790, 'cartao'),
  tx('2026-08-03', 'Café da manhã', 'restaurante', -1850, 'carteira'),
  tx('2026-08-03', 'Uber para o centro', 'transporte', -2430, 'cartao'),
  tx('2026-08-02', 'Freela — identidade visual', 'freela', 162000, 'corrente'),
  tx('2026-08-02', 'Aluguel', 'casa', -185000, 'corrente'),
  tx('2026-08-02', 'Conta de luz', 'contas', -21370, 'corrente'),
  tx('2026-08-02', 'Netflix', 'assinaturas', -4490, 'cartao'),
  tx('2026-08-02', 'Cinema', 'lazer', -7600, 'carteira'),
  tx('2026-08-01', 'Salário de agosto', 'salario', 680000, 'corrente'),
  tx('2026-08-01', 'Posto Shell', 'transporte', -22000, 'cartao'),
  tx('2026-08-01', 'Farmácia São Paulo', 'saude', -13240, 'cartao'),
  tx('2026-08-01', 'Mercado Dia', 'mercado', -15820, 'carteira'),
  tx('2026-08-01', 'Curso de inglês', 'educacao', -8990, 'cartao'),
  tx('2026-08-01', 'Academia', 'saude', -11990, 'corrente'),
];

export const metas: Meta[] = [
  {
    id: 'chile',
    nome: 'Viagem para o Chile',
    alvoCentavos: 800000,
    guardadoInicialCentavos: 320000,
    prazo: 'faltam 134 dias · 15 dez 2026',
    cor: hex('#2f6f8f'),
    icone: 'M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20',
  },
  {
    id: 'reserva',
    nome: 'Reserva de emergência',
    alvoCentavos: 1200000,
    guardadoInicialCentavos: 640000,
    prazo: 'faltam 11 meses · jun 2027',
    cor: token('up'),
    icone: 'M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6z',
  },
  {
    id: 'note',
    nome: 'Notebook novo',
    alvoCentavos: 450000,
    guardadoInicialCentavos: 285000,
    prazo: 'faltam 78 dias · 20 out 2026',
    cor: token('accent'),
    icone: 'M4 5h16v10H4zM2 19h20M9 19l.6-2h4.8l.6 2',
  },
];

/** Nenhum aporte de partida: o guardado de cada meta começa na abertura dela. */
export const aportes: Aporte[] = [];

export const desafios: Desafio[] = [
  {
    id: 'reg4',
    nome: 'Registrar 4 vezes nesta semana',
    sub: 'a semana fecha domingo',
    subOff: '',
    alvo: 4,
    unidade: 'registros',
    acao: 'Registrar agora',
    progresso: 0,
    automatico: true,
    aceito: true,
    categoriaId: 'salario',
    economiaCentavos: 0,
  },
  {
    id: 'catg',
    nome: 'Categorizar tudo do mês',
    sub: '2 lançamentos sem categoria',
    subOff: '',
    alvo: 14,
    unidade: 'lançamentos',
    acao: 'Revisar 1',
    progresso: 12,
    aceito: true,
    categoriaId: 'contas',
    economiaCentavos: 0,
  },
  {
    id: 'assin',
    nome: 'Revisar as assinaturas',
    sub: '3 assinaturas ativas',
    subOff: '',
    alvo: 3,
    unidade: 'assinaturas',
    acao: 'Revisar 1',
    progresso: 1,
    aceito: true,
    categoriaId: 'assinaturas',
    economiaCentavos: 0,
  },
  {
    id: 'delivery',
    nome: 'Semana sem delivery',
    sub: 'termina domingo, 9 de agosto',
    subOff: 'opcional · R$ 312 em julho',
    alvo: 7,
    unidade: 'dias',
    acao: 'Marcar hoje',
    progresso: 0,
    aceito: false,
    categoriaId: 'restaurante',
    economiaCentavos: 31200,
  },
  {
    id: 'cafe',
    nome: '5 dias sem café fora',
    sub: 'termina sexta',
    subOff: 'opcional · R$ 12 por dia',
    alvo: 5,
    unidade: 'dias',
    acao: 'Marcar hoje',
    progresso: 0,
    aceito: false,
    categoriaId: 'restaurante',
    economiaCentavos: 6000,
  },
  {
    id: 'uber',
    nome: 'Semana sem app de transporte',
    sub: 'termina domingo',
    subOff: 'opcional · R$ 244 em julho',
    alvo: 7,
    unidade: 'dias',
    acao: 'Marcar hoje',
    progresso: 0,
    aceito: false,
    categoriaId: 'transporte',
    economiaCentavos: 24400,
  },
];

/** Histórico de semanas fechadas, anterior aos dados de transação. */
export const historicoSemanas: SemanaHistorica[] = [
  { inicio: '2026-06-30', registros: 4 },
  { inicio: '2026-07-07', registros: 4 },
  { inicio: '2026-07-14', registros: 3 },
  { inicio: '2026-07-21', registros: 4 },
  { inicio: '2026-07-28', registros: 4 },
];

/** Teto de gasto do mês. Vira `budgets.limit_cents` quando houver backend. */
export const orcamentoMensalCentavos = 500000;

/** Números de contexto que ainda não saem das transações carregadas. */
export const contexto: Contexto = {
  semanasEmDia: 5,
  lancamentosMesAnterior: 18,
  economiaBaseCentavos: 18000,
};
