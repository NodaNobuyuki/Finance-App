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
  /**
   * Une as duas pontas de uma transferência: as duas linhas carregam o mesmo
   * id. Dinheiro que muda de lugar não é receita nem despesa, então quem soma
   * gasto do mês ignora tudo que tem este campo — ver `saldo.ts`.
   */
  transferenciaId?: string;
  /**
   * Só na ENTRADA de um aporte: para qual meta esse dinheiro foi guardado.
   *
   * É daqui que sai o guardado da meta. Um dia terá saída também (resgatar da
   * meta), e a soma com sinal já funciona para os dois casos.
   */
  metaId?: string;
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
   * `guardadoInicialCentavos + soma das entradas com este `metaId`` — ver
   * `metas.ts`.
   */
  guardadoInicialCentavos: Centavos;
  /**
   * Onde o dinheiro guardado desta meta fica de verdade.
   *
   * Guardar não é fazer o dinheiro sumir da conta e reaparecer num contador: é
   * uma transferência, e transferência tem destino. Sem isto o aporte teria de
   * criar dinheiro do nada na entrada.
   */
  contaId: string;
  /**
   * Data-alvo, ou `null` para meta sem prazo.
   *
   * Era string pré-formatada (`'faltam 134 dias · 15 dez 2026'`), o que
   * envelhecia sozinho: o texto continuava dizendo 134 dias um ano depois.
   * O rótulo agora é derivado por `rotuloDePrazo()`, contra o dia corrente.
   */
  prazo: DiaISO | null;
  cor: CorRef;
  icone: string;
};

/**
 * O que é do usuário num desafio. A definição — nome, alvo, ação — é catálogo
 * e mora em `dominio/desafios.ts`; aqui fica só o que ele fez.
 */
export type ProgressoDesafio = {
  /** O id da definição no catálogo. */
  id: string;
  /** Entrou no desafio. Sem linha gravada, vale o padrão da definição. */
  aceito: boolean;
  /** Quanto já foi cumprido. Em desafio automático, é ignorado. */
  progresso: number;
};

/** Quem usa o app. Hoje só o nome; entra por onboarding. */
export type Perfil = {
  nome: string;
};

/**
 * Números que a tela ainda mostra mas que nenhum cálculo produz — vieram do
 * protótipo. Ficam agrupados aqui para que dê para achá-los quando cada um
 * virar derivação de verdade.
 *
 * `semanasEmDia` saiu daqui: virou `semanasEmDia()` em `estado/derivados.ts`.
 * Como campo, ele nascia da semente e nada o incrementava — a constância de
 * quem usava o app de verdade ficava parada em zero para sempre.
 */
export type Contexto = {
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
