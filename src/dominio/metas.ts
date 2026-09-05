import { DiaISO, diferencaEmDias, rotuloDataCurta, rotuloMesAno } from './datas';
import { Centavos } from './dinheiro';
import { Meta, Transacao } from './tipos';

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
 *   guardado = guardadoInicialCentavos + SOMA(transações com este `metaId`)
 *
 * Sai das TRANSAÇÕES, não de uma tabela de aportes à parte. Enquanto o aporte
 * era entidade própria, guardar dinheiro não movia saldo nenhum: o app dizia
 * "transforme o gasto em aporte" e o dinheiro continuava inteiro na conta.
 * Agora aporte é transferência, e as duas pontas são transações — uma escrita
 * só, sem dois livros-caixa para divergir.
 *
 * Como a soma filtra por `metaId`, entrada que aponta para meta inexistente não
 * entra em guardado nenhum. Ela continua no saldo da conta, que é onde o
 * dinheiro de fato está.
 */
export function guardadoDaMeta(meta: Meta, transacoes: Transacao[]): Centavos {
  let total = meta.guardadoInicialCentavos;
  for (const t of transacoes) {
    if (t.metaId === meta.id) total += t.valorCentavos;
  }
  return total;
}

export function totalGuardado(metas: Meta[], transacoes: Transacao[]): Centavos {
  return metas.reduce((soma, m) => soma + guardadoDaMeta(m, transacoes), 0);
}

export function faltamParaMeta(meta: Meta, transacoes: Transacao[]): Centavos {
  return Math.max(0, meta.alvoCentavos - guardadoDaMeta(meta, transacoes));
}

/**
 * Onde uma meta nova guarda dinheiro, quando a pessoa não escolhe.
 *
 * Poupança primeiro porque é onde dinheiro guardado costuma morar de verdade;
 * cartão nunca, porque guardar dinheiro em fatura não significa nada.
 */
export function contaPadraoDeMeta(contas: { id: string; tipo: string }[]): string {
  const poupanca = contas.find((c) => c.tipo === 'poupanca');
  const naoCartao = contas.find((c) => c.tipo !== 'cartao');
  return (poupanca ?? naoCartao ?? contas[0])?.id ?? '';
}

/**
 * Qual meta uma escolha de `id` aponta, tolerando id que não existe mais.
 *
 * A primeira da lista é o padrão, e é ela que responde quando o id é `null` —
 * ninguém escolheu ainda — ou aponta para meta apagada. Resolver na leitura em
 * vez de limpar a escolha ao apagar é a mesma decisão de `categoria()`: id
 * pendurado é caminho normal, não corrupção, e apagar meta já não mexe em nada
 * que aponte para ela.
 *
 * Estrutural em vez de `Meta[]` porque quem chama costuma ter a lista
 * enriquecida de `derivados.metas()`, com guardado e prazo já calculados.
 */
export function metaEscolhida<T extends { id: string }>(
  metas: T[],
  id: string | null,
): T | undefined {
  return metas.find((m) => m.id === id) ?? metas[0];
}
