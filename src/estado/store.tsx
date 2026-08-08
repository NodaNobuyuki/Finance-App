import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { categoria } from '../dominio/categorias';
import { AGORA, DiaISO, DiaRitualId, inicioDaSemana, rotuloCurto } from '../dominio/datas';
import {
  Centavos,
  deDigitos,
  deTextoLivre,
  empilharDigitos,
  formatar,
  removerDigito,
} from '../dominio/dinheiro';
import * as seed from '../dominio/seed';
import { Tela, Transacao } from '../dominio/tipos';

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

export type Folha = null | { tipo: 'nova' } | { tipo: 'aporte'; metaId: string } | { tipo: 'ritual' };

export type Estado = {
  hoje: DiaISO;
  tela: Tela;
  transacoes: Transacao[];
  /** Dias que o usuário declarou "não gastei" — contam como registro. */
  diasSemGasto: DiaISO[];

  mostrarSaldo: boolean;
  filtroConta: string;
  filtroCategoria: string;
  abaCategorias: 'despesa' | 'receita';
  insightIdx: number;

  aportes: Record<string, Centavos>;
  progressoDesafios: Record<string, number>;
  desafiosAceitos: string[];

  ritualDiaFechamento: DiaRitualId;
  metaSemanal: number;
  ritualPrimeira: boolean;
  lembrete: string;

  semanaFechada: boolean;
  fechando: boolean;
  fecharPasso: 1 | 2 | 3;
  intencao: string;
  intencaoSel: string;

  lote: Record<DiaISO, LinhaLote>;

  folha: Folha;
  rascunho: Rascunho;
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

export const estadoInicial: Estado = {
  hoje: AGORA,
  tela: 'home',
  transacoes: seed.transacoes,
  diasSemGasto: [],

  mostrarSaldo: true,
  filtroConta: 'todas',
  filtroCategoria: 'todas',
  abaCategorias: 'despesa',
  insightIdx: 0,

  aportes: {},
  progressoDesafios: {},
  desafiosAceitos: [],

  ritualDiaFechamento: 'domingo',
  metaSemanal: 4,
  ritualPrimeira: false,
  lembrete: 'domingo',

  semanaFechada: false,
  fechando: false,
  fecharPasso: 1,
  intencao: '',
  intencaoSel: '',

  lote: {},

  folha: null,
  rascunho: RASCUNHO_VAZIO,
  simDigitos: '',
  simTaxaId: 'cdi',

  toast: null,
  seq: 0,
};

/* ────────────────────────────────────────────────────────────────
   Ações
   ──────────────────────────────────────────────────────────────── */

export type Acao =
  | { tipo: 'IR_PARA'; tela: Tela }
  | { tipo: 'ALTERNAR_SALDO' }
  | { tipo: 'PROXIMO_INSIGHT'; total: number }
  | { tipo: 'FILTRO_CONTA'; conta: string }
  | { tipo: 'FILTRO_CATEGORIA'; categoria: string }
  | { tipo: 'ABA_CATEGORIAS'; aba: 'despesa' | 'receita' }
  | { tipo: 'ABRIR_NOVA'; categoriaId?: string; tipoLancamento?: 'despesa' | 'receita' }
  | { tipo: 'ABRIR_APORTE'; metaId: string }
  | { tipo: 'ABRIR_RITUAL' }
  | { tipo: 'FECHAR_FOLHA' }
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
  | { tipo: 'CONFIRMAR_APORTE' }
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
  | { tipo: 'LIMPAR_TOAST'; id: number };

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
  e: Estado,
  seq: number,
  campos: {
    contaId: string;
    categoriaId: string;
    valorCentavos: Centavos;
    ocorridoEm: DiaISO;
    descricao: string;
  },
): Transacao {
  return {
    id: `tx-${seq}`,
    contaId: campos.contaId,
    categoriaId: campos.categoriaId,
    valorCentavos: campos.valorCentavos,
    ocorridoEm: campos.ocorridoEm,
    descricao: campos.descricao,
    descricaoOriginal: campos.descricao,
    // Escrita local primeiro. O sync (quando existir) lê daqui, nunca o inverso.
    origem: 'manual',
    criadoEm: 1_000_000 + seq,
  };
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

export function reducer(e: Estado, a: Acao): Estado {
  switch (a.tipo) {
    case 'IR_PARA':
      // Sair para a Home encerra um fechamento em andamento — senão o Resumo
      // continuaria se apresentando como "passo 2 de 3".
      return { ...e, tela: a.tela, folha: null, fechando: a.tela === 'home' ? false : e.fechando };

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

    case 'ABRIR_APORTE':
      return { ...e, folha: { tipo: 'aporte', metaId: a.metaId }, rascunho: { ...e.rascunho, digitos: '' } };

    case 'ABRIR_RITUAL':
      return { ...e, folha: { tipo: 'ritual' }, ritualPrimeira: false };

    case 'FECHAR_FOLHA':
      return { ...e, folha: null };

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
      return { ...e, rascunho: { ...e.rascunho, digitos: empilharDigitos(e.rascunho.digitos, a.valor) } };

    case 'APAGAR_DIGITO':
      return { ...e, rascunho: { ...e.rascunho, digitos: removerDigito(e.rascunho.digitos) } };

    case 'DEFINIR_DIGITOS':
      return { ...e, rascunho: { ...e.rascunho, digitos: a.digitos } };

    case 'SALVAR_TRANSACAO': {
      const valor = deDigitos(e.rascunho.digitos);
      if (valor <= 0) return e;
      const seq = e.seq + 1;
      const tx = novaTransacao(e, seq, {
        contaId: e.rascunho.contaId,
        categoriaId: e.rascunho.categoriaId,
        valorCentavos: e.rascunho.tipo === 'despesa' ? -valor : valor,
        ocorridoEm: e.hoje,
        descricao: e.rascunho.descricao.trim() || categoria(e.rascunho.categoriaId).nome,
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
      const cat = categoria(a.categoriaId);
      const tx = novaTransacao(e, seq, {
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

    case 'CONFIRMAR_APORTE': {
      if (!e.folha || e.folha.tipo !== 'aporte') return e;
      const valor = deDigitos(e.rascunho.digitos);
      if (valor <= 0) return e;
      const meta = seed.metas.find((m) => m.id === (e.folha as { metaId: string }).metaId);
      if (!meta) return e;
      const seq = e.seq + 1;
      return {
        ...e,
        seq,
        aportes: { ...e.aportes, [meta.id]: (e.aportes[meta.id] ?? 0) + valor },
        folha: null,
        rascunho: { ...e.rascunho, digitos: '' },
        toast: avisar(seq, `${formatar(valor)} adicionados a ${meta.nome}`),
      };
    }

    case 'AVANCAR_DESAFIO': {
      // Desafio automático não avança no toque: ele reflete os registros da semana.
      if (a.automatico) {
        return { ...e, folha: { tipo: 'nova' }, rascunho: { ...RASCUNHO_VAZIO, contaId: e.rascunho.contaId } };
      }
      const seq = e.seq + 1;
      return {
        ...e,
        seq,
        progressoDesafios: {
          ...e.progressoDesafios,
          [a.desafioId]: (e.progressoDesafios[a.desafioId] ?? 0) + 1,
        },
        toast: avisar(seq, `Dia registrado em “${a.rotulo}”`),
      };
    }

    case 'ACEITAR_DESAFIO': {
      if (e.desafiosAceitos.includes(a.desafioId)) return e;
      const seq = e.seq + 1;
      return {
        ...e,
        seq,
        desafiosAceitos: [...e.desafiosAceitos, a.desafioId],
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
          novaTransacao(e, seq, {
            contaId: e.rascunho.contaId,
            categoriaId: linha.categoriaId,
            valorCentavos: -valor,
            ocorridoEm: dia,
            descricao: categoria(linha.categoriaId).nome,
          }),
        );
      }
      seq += 1;
      const texto =
        a.pendentes.length === 1 ? 'Dia colocado em dia' : `${a.pendentes.length} dias colocados em dia`;
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
        semanaFechada: true,
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
      const meta = seed.metas.find((m) => m.id === a.metaId);
      if (!meta) return e;
      const seq = e.seq + 1;
      return {
        ...e,
        seq,
        aportes: { ...e.aportes, [meta.id]: (e.aportes[meta.id] ?? 0) + valor },
        tela: 'metas',
        simDigitos: '',
        toast: avisar(seq, `${formatar(valor)} guardados na ${meta.nome}`),
      };
    }

    case 'SIMULAR_DO_RASCUNHO':
      return { ...e, tela: 'simulador', simDigitos: e.rascunho.digitos, folha: null };

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

const Contexto = createContext<Loja | null>(null);

export function LojaProvider({
  children,
  inicial = estadoInicial,
}: {
  children: React.ReactNode;
  inicial?: Estado;
}) {
  const [estado, despachar] = useReducer(reducer, inicial);
  const valor = useMemo(() => ({ estado, despachar }), [estado]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useLoja(): Loja {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useLoja precisa estar dentro de <LojaProvider>');
  return ctx;
}

/** Rótulo curto de um dia pendente, para as frases do card de ação. */
export function nomeDoDiaPendente(dia: DiaISO, hoje: DiaISO): string {
  return rotuloCurto(dia, hoje).toLowerCase();
}
