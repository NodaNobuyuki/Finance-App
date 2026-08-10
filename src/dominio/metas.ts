import { DiaISO, diferencaEmDias, rotuloDataCurta, rotuloMesAno } from './datas';
import { Centavos } from './dinheiro';
import { Aporte, Meta } from './tipos';

/**
 * A partir daqui o prazo é contado em meses. Abaixo disso, em dias.
 *
 * "faltam 314 dias" não ajuda ninguém a decidir nada; "faltam 10 meses" sim. E
 * na reta final o inverso vale: contar meses esconde a urgência.
 */
const DIAS_ATE_CONTAR_EM_MESES = 180;

/**
 * `"faltam 134 dias · 15 dez 2026"`, derivado contra o dia corrente.
 *
 * Este texto já foi um campo gravado. Como string, ele envelhecia sozinho: a
 * meta continuava anunciando os mesmos 134 dias meses depois, porque nada
 * recalculava. Agora só a data é dado; o texto é sempre desta chamada.
 */
export function rotuloDePrazo(prazo: DiaISO | null, hoje: DiaISO): string {
  if (!prazo) return 'sem prazo definido';

  const dias = diferencaEmDias(hoje, prazo);
  if (dias < 0) return `prazo vencido · ${rotuloDataCurta(prazo)}`;
  if (dias === 0) return `vence hoje · ${rotuloDataCurta(prazo)}`;
  if (dias === 1) return `falta 1 dia · ${rotuloDataCurta(prazo)}`;
  if (dias <= DIAS_ATE_CONTAR_EM_MESES) return `faltam ${dias} dias · ${rotuloDataCurta(prazo)}`;

  const meses = Math.round(dias / 30);
  return `faltam ${meses} meses · ${rotuloMesAno(prazo)}`;
}

/**
 * Guardado é sempre derivado, nunca uma coluna que alguém incrementa —
 * mesma regra do saldo de conta, pelo mesmo motivo:
 *
 *   guardado = guardadoInicialCentavos + SOMA(aportes da meta)
 *
 * Como a soma é sempre filtrada por `metaId`, aporte que aponta para meta
 * inexistente não entra em conta nenhuma. Ele fica visível como sobra, em vez
 * de inflar silenciosamente um total.
 */
export function guardadoDaMeta(meta: Meta, aportes: Aporte[]): Centavos {
  let total = meta.guardadoInicialCentavos;
  for (const a of aportes) {
    if (a.metaId === meta.id) total += a.valorCentavos;
  }
  return total;
}

export function totalGuardado(metas: Meta[], aportes: Aporte[]): Centavos {
  return metas.reduce((soma, m) => soma + guardadoDaMeta(m, aportes), 0);
}

export function faltamParaMeta(meta: Meta, aportes: Aporte[]): Centavos {
  return Math.max(0, meta.alvoCentavos - guardadoDaMeta(meta, aportes));
}
