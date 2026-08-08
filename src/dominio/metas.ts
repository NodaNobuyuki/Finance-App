import { Centavos } from './dinheiro';
import { Aporte, Meta } from './tipos';

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
