import { Centavos } from './dinheiro';
import { Conta, Transacao } from './tipos';

/**
 * Saldo é sempre derivado, nunca guardado como valor mutável.
 *
 *   saldo = saldoInicialCentavos + SOMA(transações da conta)
 *
 * Sem coluna atualizada por trigger, sem cache espalhado — se ficar lento,
 * o lugar de resolver é aqui (memoização/materialização), não nos chamadores.
 */
export function saldoDaConta(conta: Conta, transacoes: Transacao[]): Centavos {
  let saldo = conta.saldoInicialCentavos;
  for (const t of transacoes) {
    if (t.contaId === conta.id) saldo += t.valorCentavos;
  }
  return saldo;
}

export function saldoTotal(contas: Conta[], transacoes: Transacao[]): Centavos {
  let saldo = 0;
  for (const c of contas) saldo += c.saldoInicialCentavos;
  for (const t of transacoes) saldo += t.valorCentavos;
  return saldo;
}

/** Soma de tudo que entrou (valores positivos). */
export function totalEntradas(transacoes: Transacao[]): Centavos {
  return transacoes.reduce((a, t) => (t.valorCentavos > 0 ? a + t.valorCentavos : a), 0);
}

/** Soma de tudo que saiu, como valor POSITIVO — é assim que a UI mostra. */
export function totalSaidas(transacoes: Transacao[]): Centavos {
  return transacoes.reduce((a, t) => (t.valorCentavos < 0 ? a - t.valorCentavos : a), 0);
}

export function somaPorCategoria(transacoes: Transacao[]): Record<string, Centavos> {
  const totais: Record<string, Centavos> = {};
  for (const t of transacoes) {
    if (t.valorCentavos >= 0) continue;
    totais[t.categoriaId] = (totais[t.categoriaId] ?? 0) - t.valorCentavos;
  }
  return totais;
}
