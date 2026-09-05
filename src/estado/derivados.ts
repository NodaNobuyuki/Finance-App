import { Categoria, categoria, categoriasPorTipo } from '../dominio/categorias';
import {
  DiaISO,
  diasRitual,
  inicioDaSemana,
  letraDoDia,
  mesDe,
  nomeDoMes,
  primeiroDoMes,
  rotuloCurto,
  rotuloDiaMes,
  rotuloMesCurto,
  somarDias,
  somarMeses,
} from '../dominio/datas';
import { Centavos, formatar, percentual, renderPor } from '../dominio/dinheiro';
import { DefinicaoDesafio, definicoesDesafios, progressoDe } from '../dominio/desafios';
import { guardadoDaMeta, rotuloDePrazo, totalGuardado as somarGuardado } from '../dominio/metas';
import { ehTransferencia, somaPorCategoria, totalEntradas, totalSaidas } from '../dominio/saldo';
import { taxa } from '../dominio/taxas';
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

/**
 * Quantos dias daquela semana têm registro, contando só até `hoje`.
 *
 * É a mesma regra de contagem de `semana()`, isolada para que a trilha de
 * constância e o streak não possam divergir dela.
 */
function registrosNaSemana(registrados: Set<DiaISO>, inicio: DiaISO, hoje: DiaISO): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const dia = somarDias(inicio, i);
    if (dia <= hoje && registrados.has(dia)) n += 1;
  }
  return n;
}

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

/**
 * A semana CORRENTE já foi fechada?
 *
 * Comparar com o início da semana é o que faz o ritual reabrir sozinho na
 * virada de segunda — sem isso, um fechamento gravado valeria para sempre.
 */
export function semanaEstaFechada(e: Estado): boolean {
  return e.semanaFechada !== null && e.semanaFechada === inicioDaSemana(e.hoje);
}

/** Hoje é o dia em que o usuário escolheu fechar a semana? */
export function ehDiaDeFechar(e: Estado): boolean {
  if (semanaEstaFechada(e)) return false;
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

export function transacoesDoMesAnterior(e: Estado): Transacao[] {
  const mes = mesDe(somarMeses(primeiroDoMes(e.hoje), -1));
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
  const total = e.orcamentoMensalCentavos;
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
    // Transferência também não vira atalho — guardar dinheiro não é um gasto
    // recorrente para repetir com um toque.
    if (t.valorCentavos >= 0 || t.ocorridoEm >= inicio || ehTransferencia(t)) continue;
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

  return [...repetidas, ...resto].slice(0, 4).map((categoriaId) => ({
    categoriaId,
    valorCentavos: valorHabitual(porCategoria[categoriaId]),
  }));
}

/* ── Colocar em dia ──────────────────────────────────────────── */

/** Cabem cinco pílulas na linha do dia. */
const CATEGORIAS_NO_LOTE = 5;

/**
 * As categorias oferecidas por dia em "Colocar em dia".
 *
 * Era uma lista de cinco ids de fábrica cravada na tela
 * (`['mercado', 'restaurante', 'transporte', 'casa', 'lazer']`). Desde que
 * categoria virou dado do usuário, isso oferecia o vocabulário errado: quem
 * apagou "Lazer" via uma pílula "Sem categoria" — clicável, gravando um id
 * morto — e quem criou as próprias categorias nunca as via ali.
 *
 * Sai do histórico, como `atalhosRapidos`: as mais lançadas primeiro. O
 * `sort` do JS é estável, então categoria sem histórico nenhum mantém a ordem
 * da lista da pessoa — que é o desempate certo numa instalação nova, onde
 * ninguém lançou nada ainda.
 */
export function categoriasDoLote(e: Estado): Categoria[] {
  const contagem: Record<string, number> = {};
  for (const t of e.transacoes) {
    if (t.valorCentavos >= 0 || ehTransferencia(t)) continue;
    contagem[t.categoriaId] = (contagem[t.categoriaId] ?? 0) + 1;
  }

  return [...categoriasPorTipo(e.categorias, 'despesa')]
    .sort((a, b) => (contagem[b.id] ?? 0) - (contagem[a.id] ?? 0))
    .slice(0, CATEGORIAS_NO_LOTE);
}

/* ── Insights ────────────────────────────────────────────────── */

export type Insight = { tag: string; texto: string };

export function insights(e: Estado): Insight[] {
  const doMes = transacoesDoMes(e);
  const despesas = totalSaidas(doMes);
  const porCategoria = somaPorCategoria(doMes);
  const lista: Insight[] = [];

  const topo = Object.keys(porCategoria).sort((a, b) => porCategoria[b] - porCategoria[a])[0];

  // Custo recorrente, anualizado: a maior categoria que também gastou no mês
  // anterior. Era `porCategoria['assinaturas']` — id de fábrica cravado, que
  // sumia para quem apagasse a categoria e nunca via a "Streaming" que a
  // pessoa criou. O que dá a pancada aqui é multiplicar por 12, e isso vale
  // para qualquer gasto que se repete.
  const anterior = somaPorCategoria(transacoesDoMesAnterior(e));
  const recorrente = Object.keys(porCategoria)
    .filter((id) => (anterior[id] ?? 0) > 0)
    // Sem isto o insight repetiria a categoria que "Concentração" já nomeia.
    .filter((id) => id !== topo)
    .sort((a, b) => porCategoria[b] - porCategoria[a])[0];

  if (recorrente) {
    const mensal = porCategoria[recorrente];
    lista.push({
      tag: 'Recorrente',
      texto: `${categoria(e.categorias, recorrente).nome} soma ${formatar(mensal)} por mês — ${formatar(mensal * 12)} no ano.`,
    });
  }
  if (topo && despesas > 0) {
    lista.push({
      tag: 'Concentração',
      texto: `${categoria(e.categorias, topo).nome} concentra ${percentual(
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

  if (semanaEstaFechada(e)) {
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
    titulo:
      s.pendentes.length === 1 ? '1 dia sem registro' : `${s.pendentes.length} dias sem registro`,
    sub: `Lance ${nomes} de uma vez — leva menos de um minuto.`,
    botao: 'Colocar em dia',
    destino: 'lote',
  };
}

export function statusDoRegistro(e: Estado): { titulo: string; sub: string; emDia: boolean } {
  const s = semana(e);
  const ultimo = ultimoRegistro(e);
  const seguidas = semanasEmDia(e);
  return {
    emDia: s.emDia,
    titulo: s.emDia
      ? 'Em dia'
      : s.pendentes.length === 1
        ? '1 dia sem registro'
        : `${s.pendentes.length} dias sem registro`,
    sub: s.emDia
      ? // Sem constância acumulada não há o que anunciar. Quem instalou hoje
        // não pode ler "5 semanas seguidas em dia".
        seguidas > 0
        ? `Último registro hoje · ${seguidas} ${
            seguidas === 1 ? 'semana seguida' : 'semanas seguidas'
          } em dia`
        : 'Último registro hoje'
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
  // Sem as transferências: o resumo é sobre para onde o dinheiro foi, e guardar
  // numa meta não é gasto — entraria como "maior despesa da semana".
  const daSemana = e.transacoes.filter(
    (t) => t.ocorridoEm >= s.inicio && t.valorCentavos < 0 && !ehTransferencia(t),
  );
  const total = totalSaidas(daSemana);
  const anterior = totalSaidas(e.transacoes.filter((t) => t.ocorridoEm < s.inicio));

  const porCategoria = somaPorCategoria(daSemana);
  const categorias = Object.keys(porCategoria)
    .sort((a, b) => porCategoria[b] - porCategoria[a])
    .slice(0, 3)
    .map((id) => ({
      categoriaId: id,
      nome: categoria(e.categorias, id).nome,
      valorCentavos: porCategoria[id],
      pct: percentual(porCategoria[id], total),
    }));

  const maior = [...daSemana].sort(
    (a, b) => Math.abs(b.valorCentavos) - Math.abs(a.valorCentavos),
  )[0];
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

/** Quantas colunas a trilha da tela Hábitos mostra, contando a semana corrente. */
const SEMANAS_NA_TRILHA = 6;

/**
 * Trilha de constância: uma coluna por semana, da mais antiga à corrente.
 *
 * Derivada dos dias registrados, nunca acumulada. Já foi um array gravado que
 * só crescia no fechamento da semana — e como nada escrevia nele, a trilha de
 * quem instalava o app nunca passava da semana corrente.
 *
 * Derivar também é o que mantém o número certo depois: lançamento com data
 * retroativa (importar OFX é exatamente isso) corrige a semana correspondente
 * sozinho, enquanto um contador gravado no fechamento ficaria velho para
 * sempre — o mesmo motivo pelo qual saldo e guardado são derivados.
 */
export function historicoDeSemanas(e: Estado) {
  const registrados = diasRegistrados(e);
  const atual = inicioDaSemana(e.hoje);
  const primeiro = [...registrados].sort()[0];
  // Sem registro nenhum, a trilha é só a semana corrente. Semana anterior à
  // instalação não é constância que a pessoa deixou de cumprir — mostrá-la
  // vazia acusaria falha por tempo em que o app nem existia para ela.
  const maisAntiga = primeiro ? inicioDaSemana(primeiro) : atual;

  const inicios: DiaISO[] = [];
  for (let i = 0; i < SEMANAS_NA_TRILHA; i++) {
    const inicio = somarDias(atual, -7 * i);
    inicios.unshift(inicio);
    if (inicio <= maisAntiga) break;
  }

  return inicios.map((inicio) => {
    const registros = registrosNaSemana(registrados, inicio, e.hoje);
    return {
      rotulo: rotuloDiaMes(inicio),
      registros,
      atingiu: registros >= e.metaSemanal,
      meta: e.metaSemanal,
    };
  });
}

/**
 * Semanas seguidas em que a meta de registros foi cumprida.
 *
 * A semana corrente só entra depois de bater a meta: enquanto está em
 * andamento ela não é uma semana falhada, e tratá-la como tal zeraria o streak
 * toda segunda-feira — o oposto do que um streak deve fazer.
 *
 * Não é limitada por `SEMANAS_NA_TRILHA`: aquilo é o que cabe na tela, isto é o
 * que a pessoa fez. A meta aplicada é a de hoje, inclusive às semanas
 * passadas; guardar a meta vigente em cada uma exigiria histórico gravado, que
 * é justamente o que se está tirando daqui.
 */
export function semanasEmDia(e: Estado): number {
  const registrados = diasRegistrados(e);
  if (registrados.size === 0) return 0;

  const maisAntiga = inicioDaSemana([...registrados].sort()[0]);
  let inicio = inicioDaSemana(e.hoje);
  let seguidas = 0;

  if (registrosNaSemana(registrados, inicio, e.hoje) < e.metaSemanal) {
    inicio = somarDias(inicio, -7);
  }

  while (inicio >= maisAntiga) {
    if (registrosNaSemana(registrados, inicio, e.hoje) < e.metaSemanal) break;
    seguidas += 1;
    inicio = somarDias(inicio, -7);
  }

  return seguidas;
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

/**
 * Junta o catálogo (definição) com o que é do usuário (progresso).
 *
 * Desafio publicado numa versão nova entra por aqui já com o padrão certo,
 * porque `progressoDe` cai no default quando não há linha gravada.
 */
export function desafios(e: Estado): { ativos: DesafioView[]; disponiveis: DefinicaoDesafio[] } {
  const s = semana(e);
  const ativos: DesafioView[] = [];
  const disponiveis: DefinicaoDesafio[] = [];

  for (const d of definicoesDesafios) {
    const p = progressoDe(d, e.progressoDesafios);
    if (!p.aceito) {
      disponiveis.push(d);
      continue;
    }
    // Desafio automático espelha os registros da semana; o resto conta o
    // progresso que o próprio usuário marcou.
    const atual = Math.min(d.alvo, d.automatico ? s.registros : p.progresso);
    const completo = atual >= d.alvo;
    ativos.push({
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
    });
  }

  return { ativos, disponiveis };
}

export function economizado(e: Estado): Centavos {
  return definicoesDesafios
    .filter((d) => progressoDe(d, e.progressoDesafios).aceito)
    .reduce((a, d) => a + d.economiaCentavos, e.contexto.economiaBaseCentavos);
}

/* ── Metas ───────────────────────────────────────────────────── */

export function metas(e: Estado) {
  return e.metas.map((m) => {
    const guardado = guardadoDaMeta(m, e.transacoes);
    return {
      ...m,
      guardadoCentavos: guardado,
      faltamCentavos: Math.max(0, m.alvoCentavos - guardado),
      pct: Math.min(100, percentual(guardado, m.alvoCentavos)),
      // Derivado contra `hoje`, não gravado: prazo escrito como texto
      // envelhecia sozinho e seguia anunciando os mesmos dias meses depois.
      prazoLabel: rotuloDePrazo(m.prazo, e.hoje),
    };
  });
}

export function totalGuardado(e: Estado): Centavos {
  return somarGuardado(e.metas, e.transacoes);
}

/* ── Simulador ───────────────────────────────────────────────── */

export function projecao(valorCentavos: Centavos, taxaId: string, anos: number): Centavos {
  return renderPor(valorCentavos, taxa(taxaId).bpsMensal, anos * 12);
}

/* ── Extrato ─────────────────────────────────────────────────── */

export type GrupoDoDia = {
  dia: DiaISO;
  totalCentavos: Centavos;
  itens: Transacao[];
};

/** Só o mês visível, sem os filtros de conta e categoria. */
export function transacoesDoMesVisivel(e: Estado): Transacao[] {
  const mes = mesDe(e.mesVisivel);
  return e.transacoes.filter((t) => mesDe(t.ocorridoEm) === mes);
}

export function transacoesFiltradas(e: Estado): Transacao[] {
  return transacoesDoMesVisivel(e).filter(
    (t) =>
      (e.filtroConta === 'todas' || t.contaId === e.filtroConta) &&
      (e.filtroCategoria === 'todas' || t.categoriaId === e.filtroCategoria),
  );
}

export type NavegacaoDeMes = {
  rotulo: string;
  podeVoltar: boolean;
  podeAvancar: boolean;
};

/**
 * Limites da navegação de mês no Extrato.
 *
 * Para no mês corrente à frente — mês futuro não tem o que mostrar — e no mês
 * do primeiro lançamento atrás. Sem os limites, as setas percorreriam anos
 * vazios em qualquer direção.
 */
export function navegacaoDeMes(e: Estado): NavegacaoDeMes {
  const primeiro = [...e.transacoes].sort((a, b) => (a.ocorridoEm < b.ocorridoEm ? -1 : 1))[0];
  const limiteAntigo = primeiroDoMes(primeiro?.ocorridoEm ?? e.hoje);
  const limiteRecente = primeiroDoMes(e.hoje);

  return {
    rotulo: rotuloMesCurto(e.mesVisivel),
    podeVoltar: somarMeses(e.mesVisivel, -1) >= limiteAntigo,
    podeAvancar: somarMeses(e.mesVisivel, 1) <= limiteRecente,
  };
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
