import { DiaISO, diferencaEmDias, mesmoDiaNoMesSeguinte } from './datas';
import { Centavos } from './dinheiro';
import { Transacao } from './tipos';

/**
 * Gasto que se repete todo mês, inferido do histórico.
 *
 * Não existe regra gravada: a recorrência é DERIVADA das transações, como o
 * saldo e a constância. Só a decisão da pessoa — "é mesmo recorrente", "não é"
 * — vai para o disco (`DecisaoRecorrencia`). É a divisão de desafio × progresso:
 * o que o app sabe calcular não vira coluna, e por isso se corrige sozinho
 * quando chega um extrato antigo ou um lançamento é apagado.
 */
export type Recorrencia = {
  /** Texto do banco normalizado. Estável: é a chave da decisão da pessoa. */
  chave: string;
  /** Como a pessoa vê a linha mais recente — pode ter sido renomeada. */
  descricao: string;
  /**
   * O texto da fonte, intacto. O lançamento feito a partir da recorrência o
   * carrega em `descricaoOriginal`, senão uma linha renomeada ("Streamingbr"
   * → "Netflix") cairia noutra chave e a recorrência nunca andaria.
   */
  textoOriginal: string;
  categoriaId: string;
  contaId: string;
  /** Da ocorrência mais recente. Negativo: só despesa é detectada. */
  valorCentavos: Centavos;
  /** Todas as ocorrências da sequência com o mesmo valor — assinatura, não conta de luz. */
  valorFixo: boolean;
  /** Quantos meses seguidos a sequência já tem. */
  ocorrencias: number;
  ultima: DiaISO;
  proxima: DiaISO;
};

/** O que a pessoa disse sobre uma recorrência. O `id` é a `chave`. */
export type DecisaoRecorrencia = {
  id: string;
  decisao: 'confirmada' | 'ignorada';
};

/**
 * Distância entre duas ocorrências para serem "uma por mês". O banco lança no
 * dia útil seguinte e fevereiro é curto: 25 a 35 dias cobre os dois sem
 * aceitar o quinzenal.
 */
export const INTERVALO_MENSAL = { min: 25, max: 35 } as const;

/**
 * Sem ocorrência há mais que isto, a recorrência sai da lista: a assinatura
 * foi cancelada, ou a pessoa parou de lançar. Dá uns 15 dias de atraso depois
 * do vencimento antes de desistir.
 */
export const DIAS_ATE_SUMIR = 45;

/**
 * Valor parecido o bastante para ser a mesma conta: até 25% de diferença. A
 * conta de luz varia; o mercado do mês, que varia mais, não deveria entrar.
 */
function valorParecido(a: Centavos, b: Centavos): boolean {
  const [x, y] = [Math.abs(a), Math.abs(b)];
  return 4 * Math.abs(x - y) <= Math.max(x, y);
}

export function chaveDeRecorrencia(t: Pick<Transacao, 'descricao' | 'descricaoOriginal'>): string {
  return (t.descricaoOriginal ?? t.descricao).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * As recorrências ativas, da que vence primeiro para a última.
 *
 * Agrupa as despesas pelo texto do banco e, em cada grupo, anda de trás para
 * frente enquanto as ocorrências caírem uma por mês com valor parecido. Duas
 * seguidas bastam — quem confirma é a pessoa. Lançamento no meio da sequência
 * quebra a corrida: o mercado de toda semana não é um gasto mensal.
 *
 * Parcela não entra, e não precisa de regra para isso: "Parcela 6/12" e
 * "Parcela 7/12" são textos diferentes, logo grupos diferentes.
 */
export function detectarRecorrencias(transacoes: Transacao[], hoje: DiaISO): Recorrencia[] {
  const grupos = new Map<string, Transacao[]>();
  for (const t of transacoes) {
    if (t.valorCentavos >= 0 || t.transferenciaId !== undefined || t.ocorridoEm > hoje) continue;
    const chave = chaveDeRecorrencia(t);
    if (!chave) continue;
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(t);
    else grupos.set(chave, [t]);
  }

  const encontradas: Recorrencia[] = [];
  for (const [chave, grupo] of grupos) {
    if (grupo.length < 2) continue;
    grupo.sort((a, b) =>
      a.ocorridoEm !== b.ocorridoEm
        ? a.ocorridoEm < b.ocorridoEm
          ? -1
          : 1
        : a.criadoEm - b.criadoEm,
    );

    const ultima = grupo[grupo.length - 1];
    if (diferencaEmDias(ultima.ocorridoEm, hoje) > DIAS_ATE_SUMIR) continue;

    let ocorrencias = 1;
    let valorFixo = true;
    for (let i = grupo.length - 2; i >= 0; i--) {
      const depois = grupo[i + 1];
      const antes = grupo[i];
      const intervalo = diferencaEmDias(antes.ocorridoEm, depois.ocorridoEm);
      if (
        intervalo < INTERVALO_MENSAL.min ||
        intervalo > INTERVALO_MENSAL.max ||
        !valorParecido(antes.valorCentavos, depois.valorCentavos)
      ) {
        break;
      }
      ocorrencias += 1;
      if (antes.valorCentavos !== ultima.valorCentavos) valorFixo = false;
    }
    if (ocorrencias < 2) continue;

    encontradas.push({
      chave,
      descricao: ultima.descricao,
      textoOriginal: ultima.descricaoOriginal ?? ultima.descricao,
      categoriaId: ultima.categoriaId,
      contaId: ultima.contaId,
      valorCentavos: ultima.valorCentavos,
      valorFixo,
      ocorrencias,
      ultima: ultima.ocorridoEm,
      proxima: mesmoDiaNoMesSeguinte(ultima.ocorridoEm),
    });
  }

  return encontradas.sort((a, b) =>
    a.proxima !== b.proxima ? (a.proxima < b.proxima ? -1 : 1) : a.chave < b.chave ? -1 : 1,
  );
}
