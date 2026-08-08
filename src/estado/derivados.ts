import { categoria } from '../dominio/categorias';
import {
  DiaISO,
  diasRitual,
  inicioDaSemana,
  letraDoDia,
  mesDe,
  nomeDoMes,
  rotuloCurto,
  rotuloDiaMes,
  somarDias,
} from '../dominio/datas';
import { Centavos, formatar, percentual, renderPor } from '../dominio/dinheiro';
import { somaPorCategoria, totalEntradas, totalSaidas } from '../dominio/saldo';
import * as seed from '../dominio/seed';
import { Transacao } from '../dominio/tipos';
import { Estado } from './store';

/**
 * Seleções derivadas do estado.
 *
 * Devolvem dados semânticos — nunca cor. Quem pinta é a tela, lendo tokens do
 * tema, para que trocar de paleta não exija tocar aqui.
 */

/* ── Semana e ritual ─────────────────────────────────────────── */

export type EstadoDoDia = 'registrado' | 'hoje-aberto' | 'aberto' | 'futuro';

export type DiaDaSemana = {
  dia: DiaISO;
  letra: string;
  estado: EstadoDoDia;
  ehHoje: boolean;
};

export function diasRegistrados(e: Estado): Set<DiaISO> {
  const dias = new Set<DiaISO>(e.diasSemGasto);
  for (const t of e.transacoes) dias.add(t.ocorridoEm);
  return dias;
}

export type Semana = {
  inicio: DiaISO;
  fim: DiaISO;
  dias: DiaDaSemana[];
  /** Dias já passados (ou hoje) que ainda não têm registro. */
  pendentes: DiaISO[];
  registros: number;
  meta: number;
  emDia: boolean;
};

export function semana(e: Estado): Semana {
  const inicio = inicioDaSemana(e.hoje);
  const registrados = diasRegistrados(e);
  const dias: DiaDaSemana[] = [];
  const pendentes: DiaISO[] = [];
  let registros = 0;

  for (let i = 0; i < 7; i++) {
    const dia = somarDias(inicio, i);
    const temRegistro = registrados.has(dia);
    const ehHoje = dia === e.hoje;
    const futuro = dia > e.hoje;

    if (temRegistro && dia <= e.hoje) registros += 1;
    if (!temRegistro && !futuro) pendentes.push(dia);

    dias.push({
      dia,
      letra: letraDoDia(dia),
      ehHoje,
      estado: temRegistro ? 'registrado' : futuro ? 'futuro' : ehHoje ? 'hoje-aberto' : 'aberto',
    });
  }

  return {
    inicio,
    fim: somarDias(inicio, 6),
    dias,
    pendentes,
    registros,
    meta: e.metaSemanal,
    emDia: pendentes.length === 0,
  };
}

/** Último dia com registro, para a linha de status. */
export function ultimoRegistro(e: Estado): DiaISO | undefined {
  return [...diasRegistrados(e)].sort().reverse()[0];
}

/** Hoje é o dia em que o usuário escolheu fechar a semana? */
export function ehDiaDeFechar(e: Estado): boolean {
  if (e.semanaFechada) return false;
  const escolhido = diasRitual.find((d) => d.id === e.ritualDiaFechamento);
  if (!escolhido) return false;
  const dow = new Date(`${e.hoje}T00:00:00Z`).getUTCDay();
  return dow === escolhido.dow;
}

export function diaDeFechamento() {
  return diasRitual;
}

export function resumoDoRitual(e: Estado): string {
  const d = diasRitual.find((x) => x.id === e.ritualDiaFechamento) ?? diasRitual[6];
  return `Você fecha a semana ${d.prep} ${d.nome}, com ${e.metaSemanal} registros por semana.`;
}

/* ── Mês corrente ────────────────────────────────────────────── */

export function transacoesDoMes(e: Estado): Transacao[] {
  const mes = mesDe(e.hoje);
  return e.transacoes.filter((t) => mesDe(t.ocorridoEm) === mes);
}

export type ResumoMes = {
  receitas: Centavos;
  despesas: Centavos;
  resultado: Centavos;
  pctReceitas: number;
  pctDespesas: number;
  pctSobra: number;
};

export function resumoDoMes(e: Estado): ResumoMes {
  const doMes = transacoesDoMes(e);
  const receitas = totalEntradas(doMes);
  const despesas = totalSaidas(doMes);
  const maior = Math.max(receitas, despesas) || 1;
  return {
    receitas,
    despesas,
    resultado: receitas - despesas,
    pctReceitas: Math.round((receitas / maior) * 100),
    pctDespesas: Math.round((despesas / maior) * 100),
    pctSobra: receitas > 0 ? percentual(receitas - despesas, receitas) : 0,
  };
}

export type NivelOrcamento = 'ok' | 'atencao' | 'estouro';

export type Orcamento = {
  gasto: Centavos;
  total: Centavos;
  /** Limitado a 100 para a barra. */
  pct: number;
  /** Percentual real, que pode passar de 100. */
  pctReal: number;
  nivel: NivelOrcamento;
  restanteLabel: string;
};

export function orcamento(e: Estado): Orcamento {
  const total = seed.contexto.orcamentoMensalCentavos;
  const gasto = resumoDoMes(e).despesas;
  const pctReal = percentual(gasto, total);
  return {
    gasto,
    total,
    pct: Math.min(100, pctReal),
    pctReal,
    nivel: pctReal < 70 ? 'ok' : pctReal < 90 ? 'atencao' : 'estouro',
    restanteLabel:
      gasto <= total ? `restam ${formatar(total - gasto)}` : `${formatar(gasto - total)} acima`,
  };
}

/* ── Atalhos de registro em um toque ─────────────────────────── */

export type AtalhoRapido = { categoriaId: string; valorCentavos: Centavos };

/**
 * Sugere os 4 gastos mais prováveis a partir do histórico: categorias que se
 * repetem primeiro, no valor mais habitual (moda arredondada a R$ 5).
 *
 * Olha só para semanas fechadas, então o conjunto de botões fica estável
 * durante a semana inteira.
 */
export function atalhosRapidos(e: Estado): AtalhoRapido[] {
  const inicio = inicioDaSemana(e.hoje);

  const porCategoria: Record<string, Centavos[]> = {};
  for (const t of e.transacoes) {
    // Só o que já é hábito: o que foi lançado nesta semana ainda não conta,
    // senão os botões trocariam de lugar embaixo do dedo a cada registro.
    if (t.valorCentavos >= 0 || t.ocorridoEm >= inicio) continue;
    (porCategoria[t.categoriaId] ??= []).push(Math.abs(t.valorCentavos));
  }

  const valorHabitual = (valores: Centavos[]): Centavos => {
    const contagem: Record<number, number> = {};
    for (const v of valores) {
      const arredondado = Math.max(500, Math.round(v / 500) * 500);
      contagem[arredondado] = (contagem[arredondado] ?? 0) + 1;
    }
    return Number(
      Object.keys(contagem)
        .map(Number)
        .sort((a, b) => contagem[b] - contagem[a] || a - b)[0],
    );
  };

  const repetidas = Object.keys(porCategoria)
    .filter((k) => porCategoria[k].length >= 2)
    .sort((a, b) => porCategoria[b].length - porCategoria[a].length);
  const resto = Object.keys(porCategoria)
    .filter((k) => porCategoria[k].length < 2)
    .sort((a, b) => Math.min(...porCategoria[a]) - Math.min(...porCategoria[b]));

  return [...repetidas, ...resto]
    .slice(0, 4)
    .map((categoriaId) => ({ categoriaId, valorCentavos: valorHabitual(porCategoria[categoriaId]) }));
}

/* ── Insights ────────────────────────────────────────────────── */

export type Insight = { tag: string; texto: string };

export function insights(e: Estado): Insight[] {
  const doMes = transacoesDoMes(e);
  const despesas = totalSaidas(doMes);
  const porCategoria = somaPorCategoria(doMes);
  const lista: Insight[] = [];

  const assinaturas = porCategoria['assinaturas'] ?? 0;
  if (assinaturas > 0) {
    lista.push({
      tag: 'Assinaturas',
      texto: `Assinaturas somam ${formatar(assinaturas)} por mês — ${formatar(assinaturas * 12)} no ano.`,
    });
  }

  const topo = Object.keys(porCategoria).sort((a, b) => porCategoria[b] - porCategoria[a])[0];
  if (topo && despesas > 0) {
    lista.push({
      tag: 'Concentração',
      texto: `${categoria(topo).nome} concentra ${percentual(
        porCategoria[topo],
        despesas,
      )}% dos seus gastos em ${nomeDoMes(e.hoje)}.`,
    });
  }

  const diasCorridos = Math.max(1, Number(e.hoje.slice(8)));
  lista.push({
    tag: 'Ritmo',
    texto: `Você está gastando ${formatar(
      Math.round(despesas / diasCorridos),
    )} por dia em ${nomeDoMes(e.hoje)}.`,
  });

  return lista;
}

/* ── Card de ação da Home ────────────────────────────────────── */

export type AcaoDoDia = {
  variante: 'convite' | 'calmo';
  icone: 'calendarioOk' | 'calendarioMais' | 'relogio';
  titulo: string;
  sub: string;
  botao: string;
  destino: 'resumo' | 'fechar' | 'lote';
};

export function acaoDoDia(e: Estado): AcaoDoDia {
  const s = semana(e);

  if (e.semanaFechada) {
    return {
      variante: 'calmo',
      icone: 'calendarioOk',
      titulo: 'Semana fechada',
      sub: e.intencao
        ? `Foco desta semana: ${e.intencao.toLowerCase()}`
        : 'Você fechou a semana com os registros em dia.',
      botao: 'Rever o resumo',
      destino: 'resumo',
    };
  }

  if (ehDiaDeFechar(e)) {
    return {
      variante: 'convite',
      icone: 'calendarioMais',
      titulo: 'É seu dia de fechar',
      sub: 'Confira os dias, veja para onde o dinheiro foi e escolha um foco para a próxima.',
      botao: 'Fechar a semana',
      destino: 'fechar',
    };
  }

  if (s.emDia) {
    return {
      variante: 'calmo',
      icone: 'calendarioOk',
      titulo: 'Semana em dia',
      sub: `${s.registros} de ${s.meta} registros feitos. Veja o que a semana mostrou.`,
      botao: 'Ver resumo da semana',
      destino: 'resumo',
    };
  }

  const nomes = s.pendentes.map((d) => rotuloCurto(d, e.hoje).toLowerCase()).join(' e ');
  return {
    variante: 'convite',
    icone: 'relogio',
    titulo: s.pendentes.length === 1 ? '1 dia sem registro' : `${s.pendentes.length} dias sem registro`,
    sub: `Lance ${nomes} de uma vez — leva menos de um minuto.`,
    botao: 'Colocar em dia',
    destino: 'lote',
  };
}

export function statusDoRegistro(e: Estado): { titulo: string; sub: string; emDia: boolean } {
  const s = semana(e);
  const ultimo = ultimoRegistro(e);
  return {
    emDia: s.emDia,
    titulo: s.emDia
      ? 'Em dia'
      : s.pendentes.length === 1
        ? '1 dia sem registro'
        : `${s.pendentes.length} dias sem registro`,
    sub: s.emDia
      ? `Último registro hoje · ${seed.contexto.semanasEmDia} semanas seguidas em dia`
      : `Último registro: ${ultimo ? rotuloCurto(ultimo, e.hoje) : '—'}`,
  };
}

/* ── Resumo da semana ────────────────────────────────────────── */

export type FatiaCategoria = {
  categoriaId: string;
  nome: string;
  valorCentavos: Centavos;
  pct: number;
};

export type ResumoSemana = {
  totalCentavos: Centavos;
  delta: string;
  categorias: FatiaCategoria[];
  maiorValorCentavos: Centavos;
  maiorNome: string;
  quantidade: number;
  mediaCentavos: Centavos;
};

export function resumoDaSemana(e: Estado): ResumoSemana {
  const s = semana(e);
  const daSemana = e.transacoes.filter((t) => t.ocorridoEm >= s.inicio && t.valorCentavos < 0);
  const total = totalSaidas(daSemana);
  const anterior = totalSaidas(e.transacoes.filter((t) => t.ocorridoEm < s.inicio));

  const porCategoria = somaPorCategoria(daSemana);
  const categorias = Object.keys(porCategoria)
    .sort((a, b) => porCategoria[b] - porCategoria[a])
    .slice(0, 3)
    .map((id) => ({
      categoriaId: id,
      nome: categoria(id).nome,
      valorCentavos: porCategoria[id],
      pct: percentual(porCategoria[id], total),
    }));

  const maior = [...daSemana].sort((a, b) => Math.abs(b.valorCentavos) - Math.abs(a.valorCentavos))[0];
  const deltaPct = anterior > 0 ? Math.round(((total - anterior) / anterior) * 100) : 0;

  return {
    totalCentavos: total,
    delta:
      anterior === 0
        ? 'primeira semana registrada'
        : deltaPct <= 0
          ? `${Math.abs(deltaPct)}% a menos que na semana anterior`
          : `${deltaPct}% a mais que na semana anterior`,
    categorias,
    maiorValorCentavos: maior ? Math.abs(maior.valorCentavos) : 0,
    maiorNome: maior ? maior.descricao : '—',
    quantidade: daSemana.length,
    mediaCentavos: daSemana.length ? Math.round(total / daSemana.length) : 0,
  };
}

/** Histórico de constância: semanas anteriores + a semana corrente. */
export function historicoDeSemanas(e: Estado) {
  const s = semana(e);
  return [
    ...seed.historicoSemanas.map((h) => ({ rotulo: rotuloDiaMes(h.inicio), registros: h.registros })),
    { rotulo: rotuloDiaMes(s.inicio), registros: s.registros },
  ].map((w) => ({ ...w, atingiu: w.registros >= e.metaSemanal, meta: e.metaSemanal }));
}

/* ── Desafios ────────────────────────────────────────────────── */

export type DesafioView = {
  id: string;
  nome: string;
  sub: string;
  categoriaId: string;
  atual: number;
  alvo: number;
  pct: number;
  completo: boolean;
  progressoLabel: string;
  acaoLabel: string;
  automatico: boolean;
};

export function desafios(e: Estado): { ativos: DesafioView[]; disponiveis: typeof seed.desafios } {
  const s = semana(e);
  const estaAtivo = (id: string, padrao: boolean) => padrao || e.desafiosAceitos.includes(id);

  const ativos = seed.desafios
    .filter((d) => estaAtivo(d.id, d.ativoPorPadrao))
    .map((d) => {
      const base = d.automatico ? s.registros : d.progressoInicial;
      const atual = Math.min(d.alvo, base + (e.progressoDesafios[d.id] ?? 0));
      const completo = atual >= d.alvo;
      return {
        id: d.id,
        nome: d.nome,
        sub: completo ? 'desafio concluído' : d.sub,
        categoriaId: d.categoriaId,
        atual,
        alvo: d.alvo,
        pct: Math.round((atual / d.alvo) * 100),
        completo,
        progressoLabel: `${atual} de ${d.alvo} ${d.unidade}`,
        acaoLabel: completo ? 'Concluído' : d.acao,
        automatico: d.automatico === true,
      };
    });

  const disponiveis = seed.desafios.filter((d) => !estaAtivo(d.id, d.ativoPorPadrao));
  return { ativos, disponiveis };
}

export function economizado(e: Estado): Centavos {
  const ativos = seed.desafios.filter((d) => d.ativoPorPadrao || e.desafiosAceitos.includes(d.id));
  return ativos.reduce((a, d) => a + d.economiaCentavos, seed.contexto.economiaBaseCentavos);
}

/* ── Metas ───────────────────────────────────────────────────── */

export function metas(e: Estado) {
  return seed.metas.map((m) => {
    const guardado = m.guardadoInicialCentavos + (e.aportes[m.id] ?? 0);
    return {
      ...m,
      guardadoCentavos: guardado,
      faltamCentavos: Math.max(0, m.alvoCentavos - guardado),
      pct: Math.min(100, percentual(guardado, m.alvoCentavos)),
    };
  });
}

export function totalGuardado(e: Estado): Centavos {
  return metas(e).reduce((a, m) => a + m.guardadoCentavos, 0);
}

/* ── Simulador ───────────────────────────────────────────────── */

export function projecao(valorCentavos: Centavos, taxaId: string, anos: number): Centavos {
  const taxa = seed.taxas.find((t) => t.id === taxaId) ?? seed.taxas[1];
  return renderPor(valorCentavos, taxa.bpsMensal, anos * 12);
}

/* ── Extrato ─────────────────────────────────────────────────── */

export type GrupoDoDia = {
  dia: DiaISO;
  totalCentavos: Centavos;
  itens: Transacao[];
};

export function transacoesFiltradas(e: Estado): Transacao[] {
  return e.transacoes.filter(
    (t) =>
      (e.filtroConta === 'todas' || t.contaId === e.filtroConta) &&
      (e.filtroCategoria === 'todas' || t.categoriaId === e.filtroCategoria),
  );
}

export function agruparPorDia(transacoes: Transacao[]): GrupoDoDia[] {
  const dias = [...new Set(transacoes.map((t) => t.ocorridoEm))].sort().reverse();
  return dias.map((dia) => {
    const itens = transacoes.filter((t) => t.ocorridoEm === dia);
    return {
      dia,
      itens,
      totalCentavos: itens.reduce((a, t) => a + t.valorCentavos, 0),
    };
  });
}

/** Categorias que aparecem no histórico, para os chips de filtro. */
export function categoriasUsadas(e: Estado): string[] {
  return [...new Set(e.transacoes.map((t) => t.categoriaId))];
}
