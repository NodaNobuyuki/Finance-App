import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { AppState } from 'react-native';
import {
  Categoria,
  categoria,
  CATEGORIA_TRANSFERENCIA,
  categoriasPorTipo,
  coresDeCategoria,
  icones,
  iconesDeCategoria,
} from '../dominio/categorias';
import { definicoesDesafios, progressoDe } from '../dominio/desafios';
import {
  AGORA,
  DiaISO,
  DiaRitualId,
  hojeReal,
  inicioDaSemana,
  mesDe,
  primeiroDoMes,
  rotuloCurto,
  somarMeses,
} from '../dominio/datas';
import {
  Centavos,
  deDigitos,
  deTextoLivre,
  empilharDigitos,
  formatar,
  removerDigito,
} from '../dominio/dinheiro';
import { GerarId, idsSequenciais, uuidV7 } from '../dominio/ids';
import { contaPadraoDeMeta, guardadoDaMeta } from '../dominio/metas';
import { Semente, semente, vazia } from '../dominio/seed';
import {
  Conta,
  Contexto,
  Meta,
  Perfil,
  ProgressoDesafio,
  Tela,
  Transacao,
} from '../dominio/tipos';
import { CorRef, token } from '../tema/paletas';

/* ────────────────────────────────────────────────────────────────
   Estado
   ──────────────────────────────────────────────────────────────── */

export type Rascunho = {
  tipo: 'despesa' | 'receita';
  digitos: string;
  categoriaId: string;
  contaId: string;
  descricao: string;
};

export type LinhaLote = {
  texto: string;
  categoriaId: string;
  semGasto: boolean;
};

/** O toast carrega a própria ação — quem o exibe só faz `dispatch(toast.acao.acao)`. */
export type Toast = {
  id: number;
  texto: string;
  sub?: string;
  acao?: { rotulo: string; acao: Acao };
  /** Ação destrutiva desfazível fica mais tempo em tela. */
  duracaoMs: number;
};

export type Folha =
  | null
  | { tipo: 'nova' }
  /** Guardar ou retirar de uma meta — as duas pontas do mesmo movimento. */
  | { tipo: 'movimentoMeta'; metaId: string; retirar: boolean }
  /** Transferência entre duas contas quaisquer, sem meta envolvida. */
  | { tipo: 'transferencia' }
  | { tipo: 'ritual' }
  | { tipo: 'conta' }
  | { tipo: 'meta' }
  | { tipo: 'categoria' }
  | { tipo: 'recategorizar'; transacaoId: string };

/**
 * Rascunho de cadastro de conta e de meta.
 *
 * `id` nulo é criação; preenchido é edição da linha existente. Um só rascunho
 * por vez porque uma folha por vez é o que a interface abre — dois campos
 * paralelos só criariam estado morto para manter em sincronia.
 *
 * Não é persistido, pelo mesmo motivo do onboarding: quem fecha o app no meio
 * de um cadastro começa de novo, e é melhor assim do que reabrir num formulário
 * pela metade sem lembrar o que estava fazendo.
 */
export type CadastroConta = {
  id: string | null;
  nome: string;
  tipo: Conta['tipo'];
  digitos: string;
};

export type CadastroCategoria = {
  id: string | null;
  nome: string;
  tipo: 'despesa' | 'receita';
  cor: CorRef;
  icone: string;
};

export type CadastroMeta = {
  id: string | null;
  nome: string;
  digitos: string;
  prazo: DiaISO | null;
  /** Onde o dinheiro guardado desta meta fica — destino do aporte. */
  contaId: string;
};

const CADASTRO_CONTA_VAZIO: CadastroConta = {
  id: null,
  nome: '',
  tipo: 'corrente',
  digitos: '',
};

const CADASTRO_CATEGORIA_VAZIO: CadastroCategoria = {
  id: null,
  nome: '',
  tipo: 'despesa',
  cor: coresDeCategoria[0],
  icone: iconesDeCategoria[0],
};

const CADASTRO_META_VAZIO: CadastroMeta = {
  id: null,
  nome: '',
  digitos: '',
  prazo: null,
  contaId: '',
};

/**
 * Rascunho do primeiro uso. Não é persistido: quem fecha o app no meio começa
 * de novo, e é melhor assim do que reabrir num passo 2 sem contexto.
 */
export type Onboarding = {
  passo: 1 | 2 | 3;
  nome: string;
  contaNome: string;
  contaTipo: Conta['tipo'];
  contaDigitos: string;
  metaNome: string;
  metaDigitos: string;
};

const ONBOARDING_VAZIO: Onboarding = {
  passo: 1,
  nome: '',
  contaNome: 'Conta corrente',
  contaTipo: 'corrente',
  contaDigitos: '',
  metaNome: '',
  metaDigitos: '',
};

export type Estado = {
  hoje: DiaISO;
  tela: Tela;

  /* ── Entidades ──────────────────────────────────────────────────
     Tudo o que é dado do usuário mora aqui, e só aqui. Nada disto pode
     voltar a ser constante de módulo: o que não está no estado não tem
     como ser persistido nem recarregado. */
  perfil: Perfil;
  transacoes: Transacao[];
  contas: Conta[];
  metas: Meta[];
  /**
   * Categorias são dado do usuário, não catálogo.
   *
   * `categoriasDeFabrica` é só a semente de instalação nova. Enquanto isto era
   * um `Record` de módulo, elas eram imutáveis por construção e "Nova
   * categoria" não tinha onde gravar.
   */
  categorias: Categoria[];
  /** Só o que é do usuário; a definição do desafio é catálogo. */
  progressoDesafios: ProgressoDesafio[];
  /**
   * Dias que o usuário declarou "não gastei" — contam como registro.
   *
   * Junto com as datas das transações, é daqui que sai toda a constância:
   * trilha de semanas e streak são derivados, não contadores gravados.
   */
  diasSemGasto: DiaISO[];
  orcamentoMensalCentavos: Centavos;
  contexto: Contexto;

  /** Já passou pelo primeiro uso. Persistido: só acontece uma vez. */
  onboardingConcluido: boolean;
  onboarding: Onboarding;

  mostrarSaldo: boolean;
  filtroConta: string;
  filtroCategoria: string;
  /**
   * Mês que o Extrato mostra, ancorado no dia 1.
   *
   * O cabeçalho sempre anunciou um mês, mas a lista trazia o histórico inteiro
   * — a tela prometia um recorte que não existia. Estado de sessão, como os
   * filtros: reabrir o app volta para o mês corrente.
   */
  mesVisivel: DiaISO;
  abaCategorias: 'despesa' | 'receita';
  /** Tela Categorias em modo de edição: o toque no item abre o cadastro. */
  editandoCategorias: boolean;
  insightIdx: number;

  ritualDiaFechamento: DiaRitualId;
  metaSemanal: number;
  ritualPrimeira: boolean;
  lembrete: string;

  /**
   * Início (segunda-feira) da semana que o usuário fechou, ou `null`.
   *
   * Já foi `boolean`. Em memória isso passava, porque o app reabria zerado; com
   * persistência, um `true` gravado congela o ritual para sempre — nenhuma
   * semana seguinte volta a pedir fechamento. Guardar QUAL semana faz a virada
   * acontecer sozinha: ver `semanaEstaFechada` em `derivados.ts`.
   */
  semanaFechada: DiaISO | null;
  fechando: boolean;
  fecharPasso: 1 | 2 | 3;
  intencao: string;
  intencaoSel: string;

  lote: Record<DiaISO, LinhaLote>;

  folha: Folha;
  rascunho: Rascunho;
  /**
   * Destino da transferência entre contas. Origem e valor saem do `rascunho`,
   * que já tem a conta e o teclado ligados — um rascunho paralelo só para isto
   * duplicaria a fiação do teclado numérico inteira.
   */
  transferenciaDestinoId: string;
  cadastroConta: CadastroConta;
  cadastroMeta: CadastroMeta;
  cadastroCategoria: CadastroCategoria;
  simDigitos: string;
  simTaxaId: string;

  toast: Toast | null;
  /** Contador para ids determinísticos — nada de `Date.now()` dentro do reducer. */
  seq: number;
};

const RASCUNHO_VAZIO: Rascunho = {
  tipo: 'despesa',
  digitos: '',
  categoriaId: 'mercado',
  contaId: 'cartao',
  descricao: '',
};

/**
 * Estado de partida a partir de uma semente, ancorado num dia.
 *
 * Recebe `hoje` em vez de consultar o relógio para o teste continuar
 * determinístico; o app real passa `hojeReal()`.
 */
function estadoDe(hoje: DiaISO, s: Semente, onboardingConcluido: boolean): Estado {
  return {
    hoje,
    tela: 'home',

    perfil: s.perfil,
    transacoes: s.transacoes,
    contas: s.contas,
    metas: s.metas,
    categorias: s.categorias,
    progressoDesafios: s.progressoDesafios,
    diasSemGasto: s.diasSemGasto,
    orcamentoMensalCentavos: s.orcamentoMensalCentavos,
    contexto: s.contexto,

    onboardingConcluido,
    onboarding: ONBOARDING_VAZIO,

    mostrarSaldo: true,
    filtroConta: 'todas',
    filtroCategoria: 'todas',
    mesVisivel: primeiroDoMes(hoje),
    abaCategorias: 'despesa',
    editandoCategorias: false,
    insightIdx: 0,

    ritualDiaFechamento: 'domingo',
    metaSemanal: 4,
    ritualPrimeira: false,
    lembrete: 'domingo',

    semanaFechada: null,
    fechando: false,
    fecharPasso: 1,
    intencao: '',
    intencaoSel: '',

    lote: {},

    folha: null,
    rascunho: RASCUNHO_VAZIO,
    transferenciaDestinoId: '',
    cadastroConta: CADASTRO_CONTA_VAZIO,
    cadastroMeta: CADASTRO_META_VAZIO,
    cadastroCategoria: CADASTRO_CATEGORIA_VAZIO,
    simDigitos: '',
    simTaxaId: 'cdi',

    toast: null,
    seq: 0,
  };
}

/**
 * App recém-instalado: nada dentro, onboarding pendente.
 *
 * É este o padrão do boot. A demo virou escolha explícita — semear o SQLite
 * com a Marina no primeiro uso entregaria dado de mentira como se fosse dele.
 */
export function criarEstadoVazio(hoje: DiaISO): Estado {
  return estadoDe(hoje, vazia(), false);
}

/** Dados de demonstração, como modo explícito. */
export function criarEstadoDemo(hoje: DiaISO): Estado {
  return estadoDe(hoje, semente(hoje), true);
}

/**
 * Estado da demo ancorado em `AGORA`. É o que a maior parte dos testes usa —
 * determinístico por construção.
 */
export const estadoInicial: Estado = criarEstadoDemo(AGORA);

/** Par vazio do anterior, para exercitar as telas sem dado nenhum. */
export const estadoVazio: Estado = criarEstadoVazio(AGORA);

/* ────────────────────────────────────────────────────────────────
   Ações
   ──────────────────────────────────────────────────────────────── */

export type Acao =
  | { tipo: 'IR_PARA'; tela: Tela }
  | { tipo: 'ALTERNAR_SALDO' }
  | { tipo: 'PROXIMO_INSIGHT'; total: number }
  | { tipo: 'FILTRO_CONTA'; conta: string }
  | { tipo: 'FILTRO_CATEGORIA'; categoria: string }
  | { tipo: 'MES_VISIVEL'; passo: -1 | 1 }
  | { tipo: 'ABA_CATEGORIAS'; aba: 'despesa' | 'receita' }
  | { tipo: 'EDITAR_CATEGORIAS'; ligado: boolean }
  | { tipo: 'ABRIR_NOVA'; categoriaId?: string; tipoLancamento?: 'despesa' | 'receita' }
  | { tipo: 'ABRIR_MOVIMENTO_META'; metaId: string; retirar?: boolean }
  | { tipo: 'ABRIR_TRANSFERENCIA' }
  | { tipo: 'TRANSFERENCIA_DESTINO'; contaId: string }
  | { tipo: 'CONFIRMAR_TRANSFERENCIA' }
  | { tipo: 'ABRIR_RITUAL' }
  | { tipo: 'FECHAR_FOLHA' }
  /** Sem `contaId`, é criação; com, é edição da conta existente. */
  | { tipo: 'ABRIR_CONTA'; contaId?: string }
  | { tipo: 'CADASTRO_CONTA_CAMPO'; campo: 'nome' | 'digitos'; valor: string }
  | { tipo: 'CADASTRO_CONTA_TIPO'; tipo_: Conta['tipo'] }
  | { tipo: 'SALVAR_CONTA' }
  | { tipo: 'APAGAR_CONTA'; contaId: string }
  | { tipo: 'ABRIR_META'; metaId?: string }
  | { tipo: 'CADASTRO_META_CAMPO'; campo: 'nome' | 'digitos'; valor: string }
  | { tipo: 'CADASTRO_META_PRAZO'; prazo: DiaISO | null }
  | { tipo: 'CADASTRO_META_CONTA'; contaId: string }
  | { tipo: 'ABRIR_CATEGORIA'; categoriaId?: string; tipoCategoria?: 'despesa' | 'receita' }
  | { tipo: 'CADASTRO_CATEGORIA_NOME'; valor: string }
  | { tipo: 'CADASTRO_CATEGORIA_TIPO'; tipo_: 'despesa' | 'receita' }
  | { tipo: 'CADASTRO_CATEGORIA_COR'; cor: CorRef }
  | { tipo: 'CADASTRO_CATEGORIA_ICONE'; icone: string }
  | { tipo: 'SALVAR_CATEGORIA' }
  | { tipo: 'APAGAR_CATEGORIA'; categoriaId: string }
  /** Trocar a categoria de um lançamento já feito. */
  | { tipo: 'ABRIR_RECATEGORIZAR'; transacaoId: string }
  | { tipo: 'RECATEGORIZAR'; transacaoId: string; categoriaId: string }
  | { tipo: 'SALVAR_META' }
  | { tipo: 'APAGAR_META'; metaId: string }
  | { tipo: 'RASCUNHO_TIPO'; valor: 'despesa' | 'receita' }
  | { tipo: 'RASCUNHO_CATEGORIA'; categoriaId: string }
  | { tipo: 'RASCUNHO_CONTA'; contaId: string }
  | { tipo: 'RASCUNHO_DESCRICAO'; texto: string }
  | { tipo: 'DIGITO'; valor: string }
  | { tipo: 'APAGAR_DIGITO' }
  | { tipo: 'DEFINIR_DIGITOS'; digitos: string }
  | { tipo: 'SALVAR_TRANSACAO' }
  | { tipo: 'REGISTRO_RAPIDO'; categoriaId: string; valorCentavos: Centavos }
  | { tipo: 'DESFAZER'; transacaoIds: string[]; diasSemGasto: DiaISO[] }
  | { tipo: 'CONFIRMAR_MOVIMENTO_META' }
  | { tipo: 'AVANCAR_DESAFIO'; desafioId: string; automatico: boolean; rotulo: string }
  | { tipo: 'ACEITAR_DESAFIO'; desafioId: string; nome: string }
  | { tipo: 'LOTE_VALOR'; dia: DiaISO; texto: string }
  | { tipo: 'LOTE_CATEGORIA'; dia: DiaISO; categoriaId: string }
  | { tipo: 'LOTE_SEM_GASTO'; dia: DiaISO }
  | { tipo: 'SALVAR_LOTE'; pendentes: DiaISO[] }
  | { tipo: 'RITUAL_DIA'; dia: DiaRitualId }
  | { tipo: 'RITUAL_META'; meta: number }
  | { tipo: 'RITUAL_SALVAR' }
  | { tipo: 'LEMBRETE'; id: string }
  | { tipo: 'FECHAR_INICIAR' }
  | { tipo: 'FECHAR_PASSO'; passo: 1 | 2 | 3 }
  | { tipo: 'FECHAR_INTENCAO'; id: string; nome: string }
  | { tipo: 'FECHAR_CONCLUIR' }
  | { tipo: 'IR_RESUMO'; fechando?: boolean }
  | { tipo: 'SIM_TAXA'; taxaId: string }
  | { tipo: 'SIM_DIGITO'; valor: string }
  | { tipo: 'SIM_APAGAR' }
  | { tipo: 'SIM_DEFINIR'; digitos: string }
  | { tipo: 'SIM_GUARDAR'; metaId: string }
  | { tipo: 'SIMULAR_DO_RASCUNHO' }
  | { tipo: 'DIA_MUDOU'; dia: DiaISO }
  /** Recado do mundo externo — hoje, falha ao gravar no disco. */
  | { tipo: 'AVISAR'; texto: string; sub?: string }
  | { tipo: 'ONBOARDING_CAMPO'; campo: keyof Omit<Onboarding, 'passo'>; valor: string }
  | { tipo: 'ONBOARDING_TIPO_CONTA'; tipo_: Conta['tipo'] }
  | { tipo: 'ONBOARDING_PASSO'; passo: 1 | 2 | 3 }
  | { tipo: 'ONBOARDING_CONCLUIR' }
  | { tipo: 'CARREGAR_DEMO' }
  | { tipo: 'APAGAR_DADOS' }
  | { tipo: 'RESTAURAR'; estado: Estado }
  | { tipo: 'LIMPAR_TOAST'; id: number };

/* ────────────────────────────────────────────────────────────────
   Dependências
   ──────────────────────────────────────────────────────────────── */

/**
 * O que o reducer precisa do mundo externo.
 *
 * Id e relógio são as duas únicas fontes de não-determinismo em toda a
 * escrita. Chamá-las lá dentro tornaria o reducer impuro e os testes
 * irreproduzíveis; recebê-las de fora mantém `(estado, ação) => estado` e
 * deixa o mesmo ponto de entrada pronto para o repositório, adiante.
 */
export type Dependencias = {
  gerarId: GerarId;
  /** Epoch em ms, para `criadoEm`. */
  agoraMs: () => number;
};

export const dependenciasReais: Dependencias = {
  gerarId: () => uuidV7(),
  agoraMs: () => Date.now(),
};

/** Contadores novos a cada chamada: mesma sequência de ações, mesmo resultado. */
export function dependenciasDeTeste(): Dependencias {
  let ms = 1_000_000;
  return {
    gerarId: idsSequenciais('id'),
    agoraMs: () => (ms += 1),
  };
}

/* ────────────────────────────────────────────────────────────────
   Auxiliares do reducer
   ──────────────────────────────────────────────────────────────── */

function diasRegistrados(e: Estado): Set<DiaISO> {
  const dias = new Set<DiaISO>(e.diasSemGasto);
  for (const t of e.transacoes) dias.add(t.ocorridoEm);
  return dias;
}

function registrosNaSemana(e: Estado, extras: DiaISO[] = []): number {
  const inicio = inicioDaSemana(e.hoje);
  const dias = diasRegistrados(e);
  for (const d of extras) dias.add(d);
  let n = 0;
  for (const d of dias) if (d >= inicio && d <= e.hoje) n += 1;
  return n;
}

/**
 * Mensagem de confirmação de registro: sempre devolve ao usuário onde ele está
 * na meta da semana. É esse retorno que sustenta o hábito.
 */
function toastDeRegistro(
  e: Estado,
  seq: number,
  texto: string,
  dia: DiaISO,
  desfazer: Acao,
): Toast {
  const conta = registrosNaSemana(e, [dia]);
  const falta = e.metaSemanal - conta;
  const fechou = falta <= 0;
  return {
    id: seq,
    texto,
    sub: fechou
      ? `Semana fechada · ${conta} de ${e.metaSemanal} registros`
      : `${conta} de ${e.metaSemanal} nesta semana — falta ${
          falta === 1 ? '1 para fechar' : `${falta} para fechar`
        }`,
    // Registrar errado é comum no toque rápido: undo em vez de confirmação.
    acao: fechou
      ? { rotulo: 'Ver resumo', acao: { tipo: 'IR_RESUMO' } }
      : { rotulo: 'Desfazer', acao: desfazer },
    duracaoMs: 4200,
  };
}

function avisar(seq: number, texto: string, sub?: string): Toast {
  return { id: seq, texto, sub, duracaoMs: sub ? 3600 : 2400 };
}

function novaTransacao(
  d: Dependencias,
  campos: {
    contaId: string;
    categoriaId: string;
    valorCentavos: Centavos;
    ocorridoEm: DiaISO;
    descricao: string;
    transferenciaId?: string;
    metaId?: string;
  },
): Transacao {
  return {
    id: d.gerarId(),
    contaId: campos.contaId,
    categoriaId: campos.categoriaId,
    valorCentavos: campos.valorCentavos,
    ocorridoEm: campos.ocorridoEm,
    descricao: campos.descricao,
    descricaoOriginal: campos.descricao,
    transferenciaId: campos.transferenciaId,
    metaId: campos.metaId,
    // Escrita local primeiro. O sync (quando existir) lê daqui, nunca o inverso.
    origem: 'manual',
    criadoEm: d.agoraMs(),
  };
}

/**
 * O par de transações de um aporte: sai da conta de origem, entra na conta da
 * meta. As duas pontas carregam o mesmo `transferenciaId`; só a entrada carrega
 * `metaId`, que é de onde o guardado é derivado.
 *
 * Quando origem e destino são a mesma conta — só uma conta cadastrada, por
 * exemplo — o par soma zero e o saldo não se mexe. Está certo: o dinheiro não
 * foi para lugar nenhum, ele só passou a ter dono. Mostrar o saldo caindo aí
 * seria inventar uma movimentação que não houve.
 */
function parDeTransferencia(
  d: Dependencias,
  campos: {
    contaOrigemId: string;
    contaDestinoId: string;
    valorCentavos: Centavos;
    ocorridoEm: DiaISO;
    descricao: string;
    /**
     * Em qual ponta cravar o `metaId` — sempre a que fica na conta da meta.
     *
     * Guardar marca o DESTINO (entrada positiva, guardado sobe); retirar marca
     * a ORIGEM (saída negativa, guardado desce). Transferência entre contas
     * quaisquer não marca nenhuma. É a mesma soma com sinal em `metas.ts` que
     * atende aos três casos, sem ramo especial.
     */
    meta?: { id: string; lado: 'origem' | 'destino' };
  },
): [Transacao, Transacao] {
  const transferenciaId = d.gerarId();
  const comum = {
    categoriaId: CATEGORIA_TRANSFERENCIA,
    ocorridoEm: campos.ocorridoEm,
    descricao: campos.descricao,
    transferenciaId,
  };

  return [
    novaTransacao(d, {
      ...comum,
      contaId: campos.contaOrigemId,
      valorCentavos: -campos.valorCentavos,
      metaId: campos.meta?.lado === 'origem' ? campos.meta.id : undefined,
    }),
    novaTransacao(d, {
      ...comum,
      contaId: campos.contaDestinoId,
      valorCentavos: campos.valorCentavos,
      metaId: campos.meta?.lado === 'destino' ? campos.meta.id : undefined,
    }),
  ];
}

/**
 * Aplica `mudar` ao progresso de um desafio, criando a linha se ela ainda não
 * existir — o padrão do catálogo vale enquanto ninguém tocou no desafio.
 */
function comProgresso(
  e: Estado,
  desafioId: string,
  mudar: (p: ProgressoDesafio) => ProgressoDesafio,
): ProgressoDesafio[] {
  const definicao = definicoesDesafios.find((d) => d.id === desafioId);
  if (!definicao) return e.progressoDesafios;

  const atual = progressoDe(definicao, e.progressoDesafios);
  const novo = mudar(atual);
  return e.progressoDesafios.some((p) => p.id === desafioId)
    ? e.progressoDesafios.map((p) => (p.id === desafioId ? novo : p))
    : [...e.progressoDesafios, novo];
}

/** Cor de uma conta nova, por tipo. A paleta resolve o token na hora de pintar. */
function corDaConta(tipo: Conta['tipo']): CorRef {
  switch (tipo) {
    case 'cartao':
      return token('down');
    case 'poupanca':
      return token('up');
    default:
      return token('accent');
  }
}

const LINHA_LOTE_VAZIA: LinhaLote = { texto: '', categoriaId: 'mercado', semGasto: false };

function linhaDoLote(e: Estado, dia: DiaISO): LinhaLote {
  return e.lote[dia] ?? LINHA_LOTE_VAZIA;
}

function ordenar(transacoes: Transacao[]): Transacao[] {
  return [...transacoes].sort((a, b) => {
    if (a.ocorridoEm !== b.ocorridoEm) return a.ocorridoEm < b.ocorridoEm ? 1 : -1;
    return b.criadoEm - a.criadoEm;
  });
}

/* ────────────────────────────────────────────────────────────────
   Reducer
   ──────────────────────────────────────────────────────────────── */

/**
 * Monta o reducer com as dependências que ele precisa do mundo externo.
 *
 * Continua sendo `(estado, ação) => estado` puro: dado o mesmo par de
 * dependências, a mesma sequência de ações produz sempre o mesmo estado.
 */
export function criarReducer(d: Dependencias) {
  return function reducer(e: Estado, a: Acao): Estado {
    return aplicarAcao(d, e, a);
  };
}

function aplicarAcao(d: Dependencias, e: Estado, a: Acao): Estado {
  switch (a.tipo) {
    case 'IR_PARA':
      // Sair para a Home encerra um fechamento em andamento — senão o Resumo
      // continuaria se apresentando como "passo 2 de 3".
      return {
        ...e,
        tela: a.tela,
        folha: null,
        fechando: a.tela === 'home' ? false : e.fechando,
        // Entrar no Extrato sempre começa no mês corrente. Reabrir a tela em
        // março porque foi lá que a pessoa parou meses atrás é desorientador.
        mesVisivel: a.tela === 'extrato' ? primeiroDoMes(e.hoje) : e.mesVisivel,
      };

    case 'MES_VISIVEL': {
      const alvo = somarMeses(e.mesVisivel, a.passo);
      // Mês futuro não tem o que mostrar, e voltar antes do primeiro registro
      // é percorrer tempo em que o app não existia para a pessoa.
      const primeiro = [...e.transacoes].sort((x, y) => (x.ocorridoEm < y.ocorridoEm ? -1 : 1))[0];
      const limiteAntigo = primeiroDoMes(primeiro?.ocorridoEm ?? e.hoje);
      const limiteRecente = primeiroDoMes(e.hoje);
      if (alvo < limiteAntigo || alvo > limiteRecente) return e;
      return { ...e, mesVisivel: alvo };
    }

    case 'ALTERNAR_SALDO':
      return { ...e, mostrarSaldo: !e.mostrarSaldo };

    case 'PROXIMO_INSIGHT':
      return { ...e, insightIdx: (e.insightIdx + 1) % Math.max(1, a.total) };

    case 'FILTRO_CONTA':
      return { ...e, filtroConta: a.conta };

    case 'FILTRO_CATEGORIA':
      return { ...e, filtroCategoria: a.categoria };

    case 'ABA_CATEGORIAS':
      return { ...e, abaCategorias: a.aba };

    case 'EDITAR_CATEGORIAS':
      return { ...e, editandoCategorias: a.ligado };

    case 'ABRIR_NOVA': {
      const tipo = a.tipoLancamento ?? 'despesa';
      return {
        ...e,
        folha: { tipo: 'nova' },
        rascunho: {
          ...RASCUNHO_VAZIO,
          tipo,
          categoriaId: a.categoriaId ?? (tipo === 'despesa' ? 'mercado' : 'salario'),
          contaId: e.rascunho.contaId,
        },
      };
    }

    case 'ABRIR_MOVIMENTO_META': {
      const retirar = a.retirar === true;
      const meta = e.metas.find((m) => m.id === a.metaId);
      return {
        ...e,
        folha: { tipo: 'movimentoMeta', metaId: a.metaId, retirar },
        // Ao retirar, a conta escolhida é o DESTINO — a origem é a conta da
        // meta, que não é escolha. Sai da conta da meta e vai para onde a
        // pessoa apontar; guardar é o contrário.
        rascunho: {
          ...e.rascunho,
          digitos: '',
          contaId:
            retirar && meta && e.rascunho.contaId === meta.contaId
              ? (e.contas.find((c) => c.id !== meta.contaId)?.id ?? e.rascunho.contaId)
              : e.rascunho.contaId,
        },
      };
    }

    case 'ABRIR_TRANSFERENCIA': {
      const origem = e.contas.find((c) => c.id === e.rascunho.contaId) ?? e.contas[0];
      const destino = e.contas.find((c) => c.id !== origem?.id);
      return {
        ...e,
        folha: { tipo: 'transferencia' },
        rascunho: { ...e.rascunho, digitos: '', contaId: origem?.id ?? '' },
        transferenciaDestinoId: destino?.id ?? '',
      };
    }

    case 'TRANSFERENCIA_DESTINO':
      return { ...e, transferenciaDestinoId: a.contaId };

    case 'ABRIR_RITUAL':
      return { ...e, folha: { tipo: 'ritual' }, ritualPrimeira: false };

    case 'FECHAR_FOLHA':
      return { ...e, folha: null };

    case 'ABRIR_CONTA': {
      const existente = e.contas.find((c) => c.id === a.contaId);
      return {
        ...e,
        folha: { tipo: 'conta' },
        cadastroConta: existente
          ? {
              id: existente.id,
              nome: existente.nome,
              tipo: existente.tipo,
              digitos: String(Math.abs(existente.saldoInicialCentavos)),
            }
          : CADASTRO_CONTA_VAZIO,
      };
    }

    case 'CADASTRO_CONTA_CAMPO':
      return { ...e, cadastroConta: { ...e.cadastroConta, [a.campo]: a.valor } };

    case 'CADASTRO_CONTA_TIPO':
      return { ...e, cadastroConta: { ...e.cadastroConta, tipo: a.tipo_ } };

    case 'SALVAR_CONTA': {
      const c = e.cadastroConta;
      const nome = c.nome.trim();
      if (!nome) return e;

      // Cartão é dívida: o saldo de abertura entra negativo. Digitar "-" num
      // teclado numérico de app de finanças é fricção sem ganho — o tipo da
      // conta já diz o sinal.
      const magnitude = deDigitos(c.digitos);
      const saldoInicialCentavos = c.tipo === 'cartao' ? -magnitude : magnitude;

      const seq = e.seq + 1;
      const anterior = c.id ? e.contas.find((x) => x.id === c.id) : undefined;

      if (anterior) {
        const conta: Conta = {
          ...anterior,
          nome,
          tipo: c.tipo,
          saldoInicialCentavos,
          // Cor escolhida a dedo (as da demo, por exemplo) sobrevive à edição;
          // só trocar o tipo justifica repintar.
          cor: c.tipo === anterior.tipo ? anterior.cor : corDaConta(c.tipo),
        };
        return {
          ...e,
          seq,
          contas: e.contas.map((x) => (x.id === conta.id ? conta : x)),
          folha: null,
          cadastroConta: CADASTRO_CONTA_VAZIO,
          toast: avisar(seq, `${nome} atualizada`),
        };
      }

      const conta: Conta = {
        id: d.gerarId(),
        nome,
        tipo: c.tipo,
        saldoInicialCentavos,
        cor: corDaConta(c.tipo),
      };
      return {
        ...e,
        seq,
        contas: [...e.contas, conta],
        folha: null,
        cadastroConta: CADASTRO_CONTA_VAZIO,
        // Sem conta antes, o rascunho apontava para o vazio: a primeira criada
        // vira o destino padrão do próximo lançamento.
        rascunho: e.contas.length === 0 ? { ...e.rascunho, contaId: conta.id } : e.rascunho,
        toast: avisar(seq, `${nome} criada`),
      };
    }

    case 'APAGAR_CONTA': {
      const conta = e.contas.find((c) => c.id === a.contaId);
      if (!conta) return e;

      const seq = e.seq + 1;
      // Ficar sem nenhuma conta deixaria o app sem destino para lançamento —
      // e o caminho de volta seria refazer o onboarding. Regra de domínio, não
      // limitação de tela: melhor a pessoa criar a substituta antes.
      if (e.contas.length === 1) {
        return {
          ...e,
          seq,
          toast: avisar(
            seq,
            'Esta é sua única conta',
            'Crie outra antes de apagar — o app precisa de pelo menos uma.',
          ),
        };
      }

      // Os lançamentos vão junto. Deixá-los órfãos tiraria o dinheiro deles do
      // saldo de toda conta (a soma filtra por `contaId`) e os manteria no
      // Extrato: o total mudaria sem que nada explicasse por quê.
      const transacoes = e.transacoes.filter((t) => t.contaId !== conta.id);
      const perdidas = e.transacoes.length - transacoes.length;
      const restantes = e.contas.filter((c) => c.id !== conta.id);

      // Meta que guardava aqui precisa de outro destino, senão o próximo aporte
      // criaria a entrada numa conta que não existe — dinheiro no vácuo.
      const abrigo = contaPadraoDeMeta(restantes);
      const metas = e.metas.map((m) => (m.contaId === conta.id ? { ...m, contaId: abrigo } : m));

      return {
        ...e,
        seq,
        contas: restantes,
        transacoes,
        metas,
        folha: null,
        cadastroConta: CADASTRO_CONTA_VAZIO,
        rascunho:
          e.rascunho.contaId === conta.id
            ? { ...e.rascunho, contaId: restantes[0].id }
            : e.rascunho,
        toast: {
          id: seq,
          texto: `${conta.nome} apagada`,
          sub: perdidas > 0 ? `${perdidas} lançamentos foram junto.` : undefined,
          acao: { rotulo: 'Desfazer', acao: { tipo: 'RESTAURAR', estado: { ...e, folha: null } } },
          duracaoMs: 6000,
        },
      };
    }

    case 'ABRIR_CATEGORIA': {
      const existente = e.categorias.find((c) => c.id === a.categoriaId);
      return {
        ...e,
        folha: { tipo: 'categoria' },
        cadastroCategoria: existente
          ? {
              id: existente.id,
              // `transferencia` nunca chega aqui: ela não aparece na tela
              // Categorias. Ainda assim o rascunho só sabe dos dois tipos que a
              // pessoa escolhe, então o fallback é despesa.
              tipo: existente.tipo === 'receita' ? 'receita' : 'despesa',
              nome: existente.nome,
              cor: existente.cor,
              icone: existente.icone,
            }
          : { ...CADASTRO_CATEGORIA_VAZIO, tipo: a.tipoCategoria ?? e.abaCategorias },
      };
    }

    case 'CADASTRO_CATEGORIA_NOME':
      return { ...e, cadastroCategoria: { ...e.cadastroCategoria, nome: a.valor } };

    case 'CADASTRO_CATEGORIA_TIPO':
      return { ...e, cadastroCategoria: { ...e.cadastroCategoria, tipo: a.tipo_ } };

    case 'CADASTRO_CATEGORIA_COR':
      return { ...e, cadastroCategoria: { ...e.cadastroCategoria, cor: a.cor } };

    case 'CADASTRO_CATEGORIA_ICONE':
      return { ...e, cadastroCategoria: { ...e.cadastroCategoria, icone: a.icone } };

    case 'SALVAR_CATEGORIA': {
      const c = e.cadastroCategoria;
      const nome = c.nome.trim();
      if (!nome) return e;

      const seq = e.seq + 1;
      const anterior = c.id ? e.categorias.find((x) => x.id === c.id) : undefined;

      if (anterior) {
        // O id NÃO muda na edição, mesmo trocando o nome: ele é a chave que os
        // lançamentos já gravados apontam. Renomear "Mercado" para "Compras"
        // tem de levar o histórico junto, não deixá-lo órfão.
        const categoria: Categoria = { ...anterior, nome, tipo: c.tipo, cor: c.cor, icone: c.icone };
        return {
          ...e,
          seq,
          categorias: e.categorias.map((x) => (x.id === categoria.id ? categoria : x)),
          folha: null,
          cadastroCategoria: CADASTRO_CATEGORIA_VAZIO,
          toast: avisar(seq, `${nome} atualizada`),
        };
      }

      const categoria: Categoria = {
        id: d.gerarId(),
        nome,
        tipo: c.tipo,
        cor: c.cor,
        icone: c.icone,
      };
      return {
        ...e,
        seq,
        categorias: [...e.categorias, categoria],
        folha: null,
        cadastroCategoria: CADASTRO_CATEGORIA_VAZIO,
        toast: avisar(seq, `${nome} criada`),
      };
    }

    case 'APAGAR_CATEGORIA': {
      const categoria = e.categorias.find((c) => c.id === a.categoriaId);
      if (!categoria) return e;

      const seq = e.seq + 1;

      // `transferencia` não é escolha da pessoa: é a categoria das duas pontas
      // de um movimento entre contas, e sem ela o aporte não teria como marcar
      // as linhas que cria.
      if (categoria.tipo === 'transferencia') return e;

      // Sem nenhuma categoria do tipo não há o que escolher ao lançar, e o
      // rascunho apontaria para o vazio. Mesma regra da última conta — e é ela
      // que faz "tabela vazia" significar sempre "instalação anterior à v6".
      const irmas = e.categorias.filter(
        (c) => c.tipo === categoria.tipo && c.id !== categoria.id,
      );
      if (irmas.length === 0) {
        return {
          ...e,
          seq,
          toast: avisar(
            seq,
            `${categoria.nome} é sua única categoria de ${categoria.tipo}`,
            'Crie outra antes de apagar.',
          ),
        };
      }

      // Os lançamentos FICAM, ao contrário do que acontece ao apagar conta: o
      // gasto aconteceu e o dinheiro saiu, independentemente do rótulo. Eles
      // caem no caminho da categoria órfã — aparecem como "Sem categoria",
      // preservam o id e podem ser recategorizados um a um.
      const usos = e.transacoes.filter((t) => t.categoriaId === categoria.id).length;

      return {
        ...e,
        seq,
        categorias: e.categorias.filter((c) => c.id !== categoria.id),
        folha: null,
        cadastroCategoria: CADASTRO_CATEGORIA_VAZIO,
        // O seletor de lançamento não pode ficar apontando para o que sumiu.
        rascunho:
          e.rascunho.categoriaId === categoria.id
            ? {
                ...e.rascunho,
                categoriaId: categoriasPorTipo(
                  e.categorias.filter((c) => c.id !== categoria.id),
                  e.rascunho.tipo,
                )[0]?.id ?? '',
              }
            : e.rascunho,
        filtroCategoria: e.filtroCategoria === categoria.id ? 'todas' : e.filtroCategoria,
        toast: {
          id: seq,
          texto: `${categoria.nome} apagada`,
          sub:
            usos > 0
              ? `${usos} lançamentos ficaram sem categoria — dá para recategorizar no Extrato.`
              : undefined,
          acao: { rotulo: 'Desfazer', acao: { tipo: 'RESTAURAR', estado: { ...e, folha: null } } },
          duracaoMs: 6000,
        },
      };
    }

    case 'ABRIR_RECATEGORIZAR':
      return { ...e, folha: { tipo: 'recategorizar', transacaoId: a.transacaoId } };

    case 'RECATEGORIZAR': {
      const tx = e.transacoes.find((t) => t.id === a.transacaoId);
      if (!tx) return e;

      const seq = e.seq + 1;
      const anterior = tx.categoriaId;
      return {
        ...e,
        seq,
        transacoes: e.transacoes.map((t) =>
          t.id === tx.id ? { ...t, categoriaId: a.categoriaId } : t,
        ),
        folha: null,
        toast: {
          id: seq,
          texto: `Movido para ${categoria(e.categorias, a.categoriaId).nome}`,
          acao: {
            rotulo: 'Desfazer',
            acao: { tipo: 'RECATEGORIZAR', transacaoId: tx.id, categoriaId: anterior },
          },
          duracaoMs: 6000,
        },
      };
    }

    case 'ABRIR_META': {
      const existente = e.metas.find((m) => m.id === a.metaId);
      return {
        ...e,
        folha: { tipo: 'meta' },
        cadastroMeta: existente
          ? {
              id: existente.id,
              nome: existente.nome,
              digitos: String(existente.alvoCentavos),
              prazo: existente.prazo,
              contaId: existente.contaId,
            }
          : { ...CADASTRO_META_VAZIO, contaId: contaPadraoDeMeta(e.contas) },
      };
    }

    case 'CADASTRO_META_CAMPO':
      return { ...e, cadastroMeta: { ...e.cadastroMeta, [a.campo]: a.valor } };

    case 'CADASTRO_META_PRAZO':
      return { ...e, cadastroMeta: { ...e.cadastroMeta, prazo: a.prazo } };

    case 'CADASTRO_META_CONTA':
      return { ...e, cadastroMeta: { ...e.cadastroMeta, contaId: a.contaId } };

    case 'SALVAR_META': {
      const c = e.cadastroMeta;
      const nome = c.nome.trim();
      const alvo = deDigitos(c.digitos);
      // Meta sem alvo não tem barra de progresso nem "faltam X" — não é meta.
      if (!nome || alvo <= 0) return e;

      const seq = e.seq + 1;
      const anterior = c.id ? e.metas.find((x) => x.id === c.id) : undefined;

      if (anterior) {
        // `guardadoInicialCentavos` não entra na edição de propósito: ele é
        // abertura, e o guardado atual é derivado dos aportes. Reescrevê-lo
        // aqui moveria dinheiro sem nenhum aporte por trás.
        const meta: Meta = {
          ...anterior,
          nome,
          alvoCentavos: alvo,
          prazo: c.prazo,
          // Mudar onde a meta guarda NÃO move o que já foi guardado: as
          // entradas antigas continuam na conta em que caíram, porque o
          // dinheiro está lá de verdade. Só os próximos aportes vão para cá.
          contaId: c.contaId || anterior.contaId,
        };
        return {
          ...e,
          seq,
          metas: e.metas.map((x) => (x.id === meta.id ? meta : x)),
          folha: null,
          cadastroMeta: CADASTRO_META_VAZIO,
          toast: avisar(seq, `${nome} atualizada`),
        };
      }

      const meta: Meta = {
        id: d.gerarId(),
        nome,
        alvoCentavos: alvo,
        guardadoInicialCentavos: 0,
        prazo: c.prazo,
        contaId: c.contaId || contaPadraoDeMeta(e.contas),
        cor: token('accent'),
        icone: icones.metas,
      };
      return {
        ...e,
        seq,
        metas: [...e.metas, meta],
        folha: null,
        cadastroMeta: CADASTRO_META_VAZIO,
        toast: avisar(seq, `${nome} criada`, 'Guarde o primeiro valor quando quiser.'),
      };
    }

    case 'APAGAR_META': {
      const meta = e.metas.find((m) => m.id === a.metaId);
      if (!meta) return e;

      const seq = e.seq + 1;
      // As transações ficam — inclusive as entradas com este `metaId`. O
      // dinheiro guardado é real e continua na conta onde está; some só o
      // rótulo. `guardadoDaMeta` filtra por `metaId`, então entrada de meta
      // apagada não entra em guardado nenhum, e o desfazer reconstrói o total
      // exato sem precisar guardar nada à parte.
      return {
        ...e,
        seq,
        metas: e.metas.filter((m) => m.id !== meta.id),
        folha: null,
        cadastroMeta: CADASTRO_META_VAZIO,
        toast: {
          id: seq,
          texto: `${meta.nome} apagada`,
          acao: { rotulo: 'Desfazer', acao: { tipo: 'RESTAURAR', estado: { ...e, folha: null } } },
          duracaoMs: 6000,
        },
      };
    }

    case 'RASCUNHO_TIPO':
      return {
        ...e,
        rascunho: {
          ...e.rascunho,
          tipo: a.valor,
          categoriaId: a.valor === 'despesa' ? 'mercado' : 'salario',
        },
      };

    case 'RASCUNHO_CATEGORIA':
      return { ...e, rascunho: { ...e.rascunho, categoriaId: a.categoriaId } };

    case 'RASCUNHO_CONTA':
      return { ...e, rascunho: { ...e.rascunho, contaId: a.contaId } };

    case 'RASCUNHO_DESCRICAO':
      return { ...e, rascunho: { ...e.rascunho, descricao: a.texto } };

    case 'DIGITO':
      return {
        ...e,
        rascunho: { ...e.rascunho, digitos: empilharDigitos(e.rascunho.digitos, a.valor) },
      };

    case 'APAGAR_DIGITO':
      return { ...e, rascunho: { ...e.rascunho, digitos: removerDigito(e.rascunho.digitos) } };

    case 'DEFINIR_DIGITOS':
      return { ...e, rascunho: { ...e.rascunho, digitos: a.digitos } };

    case 'SALVAR_TRANSACAO': {
      const valor = deDigitos(e.rascunho.digitos);
      if (valor <= 0) return e;
      const seq = e.seq + 1;
      const tx = novaTransacao(d, {
        contaId: e.rascunho.contaId,
        categoriaId: e.rascunho.categoriaId,
        valorCentavos: e.rascunho.tipo === 'despesa' ? -valor : valor,
        ocorridoEm: e.hoje,
        descricao: e.rascunho.descricao.trim() || categoria(e.categorias, e.rascunho.categoriaId).nome,
      });
      const rotulo = `${e.rascunho.tipo === 'despesa' ? 'Despesa' : 'Receita'} de ${formatar(valor)} registrada`;
      return {
        ...e,
        seq,
        transacoes: ordenar([tx, ...e.transacoes]),
        folha: null,
        rascunho: { ...RASCUNHO_VAZIO, contaId: e.rascunho.contaId },
        toast: toastDeRegistro(e, seq, rotulo, tx.ocorridoEm, {
          tipo: 'DESFAZER',
          transacaoIds: [tx.id],
          diasSemGasto: [],
        }),
      };
    }

    case 'REGISTRO_RAPIDO': {
      if (a.valorCentavos <= 0) return e;
      const seq = e.seq + 1;
      const cat = categoria(e.categorias, a.categoriaId);
      const tx = novaTransacao(d, {
        contaId: e.rascunho.contaId,
        categoriaId: a.categoriaId,
        valorCentavos: -a.valorCentavos,
        ocorridoEm: e.hoje,
        descricao: cat.nome,
      });
      return {
        ...e,
        seq,
        transacoes: ordenar([tx, ...e.transacoes]),
        toast: toastDeRegistro(
          e,
          seq,
          `${cat.nome} de ${formatar(a.valorCentavos)} registrada`,
          tx.ocorridoEm,
          { tipo: 'DESFAZER', transacaoIds: [tx.id], diasSemGasto: [] },
        ),
      };
    }

    case 'DESFAZER': {
      const remover = new Set(a.transacaoIds);
      const seq = e.seq + 1;
      return {
        ...e,
        seq,
        transacoes: e.transacoes.filter((t) => !remover.has(t.id)),
        diasSemGasto: e.diasSemGasto.filter((d) => !a.diasSemGasto.includes(d)),
        toast: avisar(seq, 'Registro desfeito'),
      };
    }

    case 'CONFIRMAR_MOVIMENTO_META': {
      if (!e.folha || e.folha.tipo !== 'movimentoMeta') return e;
      const { metaId, retirar } = e.folha;
      const valor = deDigitos(e.rascunho.digitos);
      if (valor <= 0) return e;
      const meta = e.metas.find((m) => m.id === metaId);
      if (!meta) return e;

      const seq = e.seq + 1;

      // Não dá para retirar o que não está guardado: o guardado ficaria
      // negativo e a meta passaria a dever dinheiro a si mesma.
      const guardado = guardadoDaMeta(meta, e.transacoes);
      if (retirar && valor > guardado) {
        return {
          ...e,
          seq,
          toast: avisar(
            seq,
            `${meta.nome} tem ${formatar(guardado)} guardados`,
            'Não dá para retirar mais do que está lá.',
          ),
        };
      }

      // `rascunho.contaId` é a outra ponta — origem ao guardar, destino ao
      // retirar. A conta da meta é sempre a ponta fixa, e é ela que leva o
      // `metaId`: entrada positiva ao guardar, saída negativa ao retirar.
      const par = parDeTransferencia(d, {
        contaOrigemId: retirar ? meta.contaId : e.rascunho.contaId,
        contaDestinoId: retirar ? e.rascunho.contaId : meta.contaId,
        valorCentavos: valor,
        ocorridoEm: e.hoje,
        descricao: retirar ? `Retirado de ${meta.nome}` : `Guardado em ${meta.nome}`,
        meta: { id: meta.id, lado: retirar ? 'origem' : 'destino' },
      });

      const outraPonta = e.contas.find((c) => c.id === e.rascunho.contaId);
      return {
        ...e,
        seq,
        transacoes: ordenar([...par, ...e.transacoes]),
        folha: null,
        rascunho: { ...e.rascunho, digitos: '' },
        toast: {
          id: seq,
          texto: retirar
            ? `${formatar(valor)} retirados de ${meta.nome}`
            : `${formatar(valor)} guardados em ${meta.nome}`,
          sub: outraPonta
            ? retirar
              ? `Voltaram para ${outraPonta.nome}.`
              : `Saíram de ${outraPonta.nome}.`
            : undefined,
          acao: {
            rotulo: 'Desfazer',
            acao: { tipo: 'DESFAZER', transacaoIds: par.map((t) => t.id), diasSemGasto: [] },
          },
          duracaoMs: 6000,
        },
      };
    }

    case 'CONFIRMAR_TRANSFERENCIA': {
      const valor = deDigitos(e.rascunho.digitos);
      if (valor <= 0) return e;

      const origem = e.contas.find((c) => c.id === e.rascunho.contaId);
      const destino = e.contas.find((c) => c.id === e.transferenciaDestinoId);
      // Transferir para a própria conta não move nada: seria um par que soma
      // zero na mesma linha, poluindo o Extrato para não dizer nada.
      if (!origem || !destino || origem.id === destino.id) return e;

      const par = parDeTransferencia(d, {
        contaOrigemId: origem.id,
        contaDestinoId: destino.id,
        valorCentavos: valor,
        ocorridoEm: e.hoje,
        descricao: `${origem.nome} → ${destino.nome}`,
      });

      const seq = e.seq + 1;
      return {
        ...e,
        seq,
        transacoes: ordenar([...par, ...e.transacoes]),
        folha: null,
        rascunho: { ...e.rascunho, digitos: '' },
        toast: {
          id: seq,
          texto: `${formatar(valor)} de ${origem.nome} para ${destino.nome}`,
          acao: {
            rotulo: 'Desfazer',
            acao: { tipo: 'DESFAZER', transacaoIds: par.map((t) => t.id), diasSemGasto: [] },
          },
          duracaoMs: 6000,
        },
      };
    }

    case 'AVANCAR_DESAFIO': {
      // Desafio automático não avança no toque: ele reflete os registros da semana.
      if (a.automatico) {
        return {
          ...e,
          folha: { tipo: 'nova' },
          rascunho: { ...RASCUNHO_VAZIO, contaId: e.rascunho.contaId },
        };
      }
      const seq = e.seq + 1;
      return {
        ...e,
        seq,
        progressoDesafios: comProgresso(e, a.desafioId, (p) => ({
          ...p,
          progresso: p.progresso + 1,
        })),
        toast: avisar(seq, `Dia registrado em “${a.rotulo}”`),
      };
    }

    case 'ACEITAR_DESAFIO': {
      const definicao = definicoesDesafios.find((d) => d.id === a.desafioId);
      if (!definicao || progressoDe(definicao, e.progressoDesafios).aceito) return e;
      const seq = e.seq + 1;
      return {
        ...e,
        seq,
        progressoDesafios: comProgresso(e, a.desafioId, (p) => ({ ...p, aceito: true })),
        toast: avisar(seq, `Você entrou em “${a.nome}”`),
      };
    }

    case 'LOTE_VALOR': {
      const atual = linhaDoLote(e, a.dia);
      return { ...e, lote: { ...e.lote, [a.dia]: { ...atual, texto: a.texto, semGasto: false } } };
    }

    case 'LOTE_CATEGORIA': {
      const atual = linhaDoLote(e, a.dia);
      return { ...e, lote: { ...e.lote, [a.dia]: { ...atual, categoriaId: a.categoriaId } } };
    }

    case 'LOTE_SEM_GASTO': {
      const atual = linhaDoLote(e, a.dia);
      return {
        ...e,
        lote: { ...e.lote, [a.dia]: { ...atual, semGasto: !atual.semGasto, texto: '' } },
      };
    }

    case 'SALVAR_LOTE': {
      const novos: Transacao[] = [];
      let seq = e.seq;
      for (const dia of a.pendentes) {
        const linha = e.lote[dia];
        if (!linha) return e;
        if (linha.semGasto) continue;
        const valor = deTextoLivre(linha.texto);
        if (valor <= 0) return e;
        seq += 1;
        novos.push(
          novaTransacao(d, {
            contaId: e.rascunho.contaId,
            categoriaId: linha.categoriaId,
            valorCentavos: -valor,
            ocorridoEm: dia,
            descricao: categoria(e.categorias, linha.categoriaId).nome,
          }),
        );
      }
      seq += 1;
      const texto =
        a.pendentes.length === 1
          ? 'Dia colocado em dia'
          : `${a.pendentes.length} dias colocados em dia`;
      return {
        ...e,
        seq,
        transacoes: ordenar([...novos, ...e.transacoes]),
        diasSemGasto: [...new Set([...e.diasSemGasto, ...a.pendentes])],
        lote: {},
        tela: e.fechando ? 'resumo' : 'home',
        fecharPasso: e.fechando ? 2 : 1,
        toast: {
          id: seq,
          texto,
          acao: {
            rotulo: 'Desfazer',
            acao: {
              tipo: 'DESFAZER',
              transacaoIds: novos.map((t) => t.id),
              diasSemGasto: a.pendentes,
            },
          },
          duracaoMs: 4200,
        },
      };
    }

    case 'RITUAL_DIA':
      return { ...e, ritualDiaFechamento: a.dia };

    case 'RITUAL_META':
      return { ...e, metaSemanal: a.meta };

    case 'RITUAL_SALVAR':
      return { ...e, folha: null, ritualPrimeira: false };

    case 'LEMBRETE':
      return { ...e, lembrete: a.id };

    case 'FECHAR_INICIAR':
      return { ...e, tela: 'fechar', fecharPasso: 1, fechando: true, intencaoSel: '' };

    case 'FECHAR_PASSO':
      return { ...e, tela: 'fechar', fecharPasso: a.passo };

    case 'FECHAR_INTENCAO':
      return { ...e, intencaoSel: a.id, intencao: a.nome };

    case 'FECHAR_CONCLUIR': {
      const seq = e.seq + 1;
      return {
        ...e,
        seq,
        // Guarda QUAL semana foi fechada. Virou a semana, o ritual volta sozinho.
        semanaFechada: inicioDaSemana(e.hoje),
        fechando: false,
        tela: 'home',
        fecharPasso: 1,
        toast: avisar(
          seq,
          'Semana fechada',
          e.intencao
            ? `Foco da próxima: ${e.intencao.toLowerCase()}`
            : 'Sua constância subiu para 6 semanas seguidas',
        ),
      };
    }

    case 'IR_RESUMO':
      return { ...e, tela: 'resumo', toast: null, fechando: a.fechando ?? e.fechando };

    case 'SIM_TAXA':
      return { ...e, simTaxaId: a.taxaId };

    case 'SIM_DIGITO':
      return { ...e, simDigitos: empilharDigitos(e.simDigitos, a.valor) };

    case 'SIM_APAGAR':
      return { ...e, simDigitos: removerDigito(e.simDigitos) };

    case 'SIM_DEFINIR':
      return { ...e, simDigitos: a.digitos };

    case 'SIM_GUARDAR': {
      const valor = deDigitos(e.simDigitos);
      if (valor <= 0) return e;
      const meta = e.metas.find((m) => m.id === a.metaId);
      if (!meta) return e;

      // É o fecho do loop de custo de oportunidade: o gasto que a pessoa
      // simulou vira dinheiro de verdade saindo da conta e indo para a meta.
      const par = parDeTransferencia(d, {
        contaOrigemId: e.rascunho.contaId,
        contaDestinoId: meta.contaId,
        valorCentavos: valor,
        ocorridoEm: e.hoje,
        descricao: `Guardado em ${meta.nome}`,
        meta: { id: meta.id, lado: 'destino' },
      });

      const seq = e.seq + 1;
      return {
        ...e,
        seq,
        transacoes: ordenar([...par, ...e.transacoes]),
        tela: 'metas',
        simDigitos: '',
        toast: {
          id: seq,
          texto: `${formatar(valor)} guardados em ${meta.nome}`,
          acao: {
            rotulo: 'Desfazer',
            acao: { tipo: 'DESFAZER', transacaoIds: par.map((t) => t.id), diasSemGasto: [] },
          },
          duracaoMs: 6000,
        },
      };
    }

    case 'SIMULAR_DO_RASCUNHO':
      return { ...e, tela: 'simulador', simDigitos: e.rascunho.digitos, folha: null };

    case 'DIA_MUDOU':
      // Só o dia muda. `semanaFechada` guarda a semana, então a virada de
      // segunda-feira reabre o ritual sem que ninguém precise zerar nada.
      return a.dia === e.hoje
        ? e
        : {
            ...e,
            hoje: a.dia,
            // Quem estava olhando o mês corrente continua olhando o mês
            // corrente depois da virada; quem tinha navegado para trás fica
            // onde estava.
            mesVisivel:
              mesDe(e.mesVisivel) === mesDe(e.hoje) ? primeiroDoMes(a.dia) : e.mesVisivel,
          };

    case 'AVISAR': {
      const seq = e.seq + 1;
      return { ...e, seq, toast: avisar(seq, a.texto, a.sub) };
    }

    case 'ONBOARDING_CAMPO':
      return { ...e, onboarding: { ...e.onboarding, [a.campo]: a.valor } };

    case 'ONBOARDING_TIPO_CONTA':
      return { ...e, onboarding: { ...e.onboarding, contaTipo: a.tipo_ } };

    case 'ONBOARDING_PASSO':
      return { ...e, onboarding: { ...e.onboarding, passo: a.passo } };

    case 'ONBOARDING_CONCLUIR': {
      const o = e.onboarding;
      const nome = o.nome.trim();
      if (!nome) return e;

      const conta: Conta = {
        id: d.gerarId(),
        nome: o.contaNome.trim() || 'Conta',
        tipo: o.contaTipo,
        saldoInicialCentavos: deDigitos(o.contaDigitos),
        cor: corDaConta(o.contaTipo),
      };

      // Meta é opcional: quem não sabe ainda o que quer não deve ficar preso
      // numa tela de cadastro no primeiro minuto de uso.
      const alvo = deDigitos(o.metaDigitos);
      const metas: Meta[] =
        o.metaNome.trim() && alvo > 0
          ? [
              {
                id: d.gerarId(),
                nome: o.metaNome.trim(),
                alvoCentavos: alvo,
                guardadoInicialCentavos: 0,
                // Prazo fica para depois: mais um campo no primeiro minuto de
                // uso é mais gente desistindo. Entra pela folha de meta.
                prazo: null,
                contaId: conta.id,
                cor: token('accent'),
                icone: icones.metas,
              },
            ]
          : [];

      const seq = e.seq + 1;
      return {
        ...e,
        seq,
        perfil: { nome },
        contas: [conta],
        metas,
        onboardingConcluido: true,
        onboarding: ONBOARDING_VAZIO,
        rascunho: { ...RASCUNHO_VAZIO, contaId: conta.id },
        tela: 'home',
        toast: avisar(seq, `Tudo pronto, ${nome.split(' ')[0]}`, 'Registre seu primeiro gasto.'),
      };
    }

    case 'CARREGAR_DEMO': {
      const seq = e.seq + 1;
      const demo = criarEstadoDemo(e.hoje);
      return {
        ...demo,
        seq,
        toast: avisar(seq, 'Dados de exemplo carregados', 'Dá para apagar tudo em Hábitos.'),
      };
    }

    case 'APAGAR_DADOS': {
      const seq = e.seq + 1;
      const vazio = criarEstadoVazio(e.hoje);
      return {
        ...vazio,
        seq,
        // Quem já passou pelo início não volta para ele: apagar é limpar o
        // conteúdo, não desfazer o cadastro.
        perfil: e.perfil,
        onboardingConcluido: e.onboardingConcluido,
        toast: {
          id: seq,
          texto: 'Tudo apagado',
          acao: { rotulo: 'Desfazer', acao: { tipo: 'RESTAURAR', estado: e } },
          duracaoMs: 6000,
        },
      };
    }

    case 'RESTAURAR': {
      const seq = e.seq + 1;
      return { ...a.estado, seq, toast: avisar(seq, 'Dados restaurados') };
    }

    case 'LIMPAR_TOAST':
      return e.toast && e.toast.id === a.id ? { ...e, toast: null } : e;

    default:
      return e;
  }
}

/* ────────────────────────────────────────────────────────────────
   Contexto
   ──────────────────────────────────────────────────────────────── */

type Loja = { estado: Estado; despachar: React.Dispatch<Acao> };

const ContextoDaLoja = createContext<Loja | null>(null);

export function LojaProvider({
  children,
  inicial = estadoInicial,
  deps = dependenciasReais,
}: {
  children: React.ReactNode;
  inicial?: Estado;
  deps?: Dependencias;
}) {
  const reducer = useMemo(() => criarReducer(deps), [deps]);
  const [estado, despachar] = useReducer(reducer, inicial);
  const valor = useMemo(() => ({ estado, despachar }), [estado]);
  return <ContextoDaLoja.Provider value={valor}>{children}</ContextoDaLoja.Provider>;
}

export function useLoja(): Loja {
  const ctx = useContext(ContextoDaLoja);
  if (!ctx) throw new Error('useLoja precisa estar dentro de <LojaProvider>');
  return ctx;
}

/**
 * Mantém `hoje` colado no relógio.
 *
 * Sem isto o dia é lido uma vez no boot e congela: quem deixa o app aberto
 * atravessa a meia-noite com a trilha da semana de ontem na tela, e o
 * lançamento vai parar no dia errado. Confere ao montar e toda vez que o app
 * volta do segundo plano — que é quando isso acontece na prática.
 */
export function useSincronizarDia(relogio: () => DiaISO = hojeReal) {
  const { estado, despachar } = useLoja();
  const atual = estado.hoje;

  useEffect(() => {
    const conferir = () => {
      const dia = relogio();
      if (dia !== atual) despachar({ tipo: 'DIA_MUDOU', dia });
    };
    conferir();
    const inscricao = AppState.addEventListener('change', (situacao) => {
      if (situacao === 'active') conferir();
    });
    return () => inscricao.remove();
  }, [atual, despachar, relogio]);
}

/** Rótulo curto de um dia pendente, para as frases do card de ação. */
export function nomeDoDiaPendente(dia: DiaISO, hoje: DiaISO): string {
  return rotuloCurto(dia, hoje).toLowerCase();
}
