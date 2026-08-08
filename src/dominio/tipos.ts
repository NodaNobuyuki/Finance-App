import { CorRef } from '../tema/paletas';
import { Centavos } from './dinheiro';
import { DiaISO } from './datas';

/**
 * De onde veio o lançamento. O usuário precisa saber a origem de cada dado
 * para confiar no que é automático.
 *
 * Os valores são o contrato com o backend (coluna `source`); o nome do campo
 * fica em pt-BR como o resto do código.
 */
export type Origem = 'manual' | 'ofx' | 'notification' | 'email' | 'csv';

export type Transacao = {
  id: string;
  contaId: string;
  categoriaId: string;
  /** Centavos inteiros. Negativo = saída. */
  valorCentavos: Centavos;
  ocorridoEm: DiaISO;
  descricao: string;
  /** Texto original da fonte, preservado sempre que houver. */
  descricaoOriginal?: string;
  /** FITID do OFX ou hash estável — base do dedupe. */
  idExterno?: string;
  origem: Origem;
  criadoEm: number;
};

export type Conta = {
  id: string;
  nome: string;
  tipo: 'carteira' | 'corrente' | 'cartao' | 'poupanca';
  /**
   * Saldo de abertura. O saldo exibido nunca é este valor: é
   * `saldoInicialCentavos + soma das transações` — ver `saldo.ts`.
   */
  saldoInicialCentavos: Centavos;
  cor: CorRef;
};

export type Meta = {
  id: string;
  nome: string;
  alvoCentavos: Centavos;
  /**
   * Saldo de abertura da meta — o que já estava guardado antes do app.
   * O guardado exibido nunca é este valor: é
   * `guardadoInicialCentavos + soma dos aportes` — ver `metas.ts`.
   */
  guardadoInicialCentavos: Centavos;
  prazo: string;
  cor: CorRef;
  icone: string;
};

/**
 * Cada vez que o usuário guarda dinheiro numa meta. É evento, não contador:
 * some o aporte e o guardado volta sozinho ao que era.
 */
export type Aporte = {
  id: string;
  metaId: string;
  /** Centavos inteiros, sempre positivo. */
  valorCentavos: Centavos;
  ocorridoEm: DiaISO;
  origem: Origem;
  criadoEm: number;
};

export type Desafio = {
  id: string;
  nome: string;
  sub: string;
  /** Subtítulo quando o desafio ainda é opcional (não foi aceito). */
  subOff: string;
  alvo: number;
  unidade: string;
  acao: string;
  /** Quanto já foi cumprido. Em desafio automático, é ignorado. */
  progresso: number;
  /** Progresso vem dos registros da semana, não de toque manual. */
  automatico?: boolean;
  /** O usuário entrou no desafio (ou ele já vem aceito de fábrica). */
  aceito: boolean;
  categoriaId: string;
  /** Quanto o desafio evitou de gasto, em centavos. */
  economiaCentavos: Centavos;
};

/** Uma semana já encerrada, para a trilha de constância. */
export type SemanaHistorica = {
  inicio: DiaISO;
  registros: number;
};

/**
 * Números que a tela ainda mostra mas que nenhum cálculo produz — vieram do
 * protótipo. Ficam agrupados aqui para que dê para achá-los quando cada um
 * virar derivação de verdade.
 */
export type Contexto = {
  semanasEmDia: number;
  lancamentosMesAnterior: number;
  economiaBaseCentavos: Centavos;
};

export type Taxa = {
  id: string;
  nome: string;
  /** Pontos-base ao mês (88 = 0,88% a.m.) — inteiro, nada de float na taxa. */
  bpsMensal: number;
  rotulo: string;
};

export type Tela =
  | 'home'
  | 'extrato'
  | 'metas'
  | 'categorias'
  | 'habitos'
  | 'simulador'
  | 'lote'
  | 'resumo'
  | 'fechar';
