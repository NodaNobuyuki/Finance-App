import { DiaISO, diferencaEmDias, mesmoDiaNoMesSeguinte } from './datas';
import { Centavos } from './dinheiro';
import { Transacao } from './tipos';

/**
 * Gasto — ou entrada — que se repete todo mês, inferido do histórico.
 *
 * Não existe regra gravada: a recorrência é DERIVADA das transações, como o
 * saldo e a constância. Só a decisão da pessoa — "é mesmo recorrente", "não é"
 * — vai para o disco (`DecisaoRecorrencia`). É a divisão de desafio × progresso:
 * o que o app sabe calcular não vira coluna, e por isso se corrige sozinho
 * quando chega um extrato antigo ou um lançamento é apagado.
 */
export type Recorrencia = {
  /**
   * Texto do banco normalizado. Estável: é a chave da decisão da pessoa.
   *
   * A de entrada leva o prefixo `entrada:` — o mesmo texto entrando e saindo
   * todo mês (o Pix de quem divide o aluguel) são duas recorrências, e a
   * decisão sobre uma não pode valer para a outra.
   */
  chave: string;
  sentido: SentidoDaRecorrencia;
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
  /** Da ocorrência mais recente, com sinal: negativo na despesa, positivo na entrada. */
  valorCentavos: Centavos;
  /** Todas as ocorrências da sequência com o mesmo valor — assinatura, não conta de luz. */
  valorFixo: boolean;
  /** Quantos meses seguidos a sequência já tem. */
  ocorrencias: number;
  ultima: DiaISO;
  proxima: DiaISO;
};

export type SentidoDaRecorrencia = 'despesa' | 'entrada';

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

const PREFIXO_ENTRADA = 'entrada:';

/** Recorrências dos dois sentidos — para quem resolve uma pela chave. */
export function todasAsRecorrencias(transacoes: Transacao[], hoje: DiaISO): Recorrencia[] {
  return [
    ...detectarRecorrencias(transacoes, hoje, 'despesa'),
    ...detectarRecorrencias(transacoes, hoje, 'entrada'),
  ];
}

/** O texto do banco normalizado — sem o prefixo de sentido, que é só da chave. */
export function chaveDeRecorrencia(t: Pick<Transacao, 'descricao' | 'descricaoOriginal'>): string {
  return (t.descricaoOriginal ?? t.descricao).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * As recorrências ativas de um sentido, da que vence primeiro para a última.
 *
 * Despesa é o padrão, e é o que a tela de comprometido, o atalho rápido e o
 * aviso de vencimento leem. Entrada — o salário — serve ao "pague-se
 * primeiro", e vem só quando pedida: somá-la ao comprometido seria abater o
 * salário das contas fixas.
 *
 * Agrupa os lançamentos pelo texto do banco e, em cada grupo, anda de trás para
 * frente enquanto as ocorrências caírem uma por mês com valor parecido. Duas
 * seguidas bastam — quem confirma é a pessoa. Lançamento no meio da sequência
 * quebra a corrida: o mercado de toda semana não é um gasto mensal.
 *
 * Parcela não entra, e não precisa de regra para isso: "Parcela 6/12" e
 * "Parcela 7/12" são textos diferentes, logo grupos diferentes.
 */
export function detectarRecorrencias(
  transacoes: Transacao[],
  hoje: DiaISO,
  sentido: SentidoDaRecorrencia = 'despesa',
): Recorrencia[] {
  const grupos = new Map<string, Transacao[]>();
  for (const t of transacoes) {
    const doSentido = sentido === 'despesa' ? t.valorCentavos < 0 : t.valorCentavos > 0;
    if (!doSentido || t.transferenciaId !== undefined || t.ocorridoEm > hoje) continue;
    const texto = chaveDeRecorrencia(t);
    if (!texto) continue;
    const chave = sentido === 'despesa' ? texto : `${PREFIXO_ENTRADA}${texto}`;
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
      sentido,
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

/* ── Pague-se primeiro ────────────────────────────────────────── */

/**
 * O que a pessoa escolheu para quando uma entrada recorrente cai: guardar uma
 * fatia antes de começar a gastar.
 *
 * A entrada em si é derivada, como toda recorrência; aqui fica só o que é
 * dela dizer — quanto, para onde, e quais ocorrências já resolveu.
 */
export type PagueSePrimeiro = {
  /** Percentual inteiro da entrada (10 = 10%). */
  percentual: number;
  /**
   * Meta que recebe a fatia. `null` é "ninguém escolheu" e vale a primeira —
   * `metaEscolhida()`, a mesma resolução do Simulador.
   */
  metaId: string | null;
  /**
   * Por chave de entrada, o dia da ocorrência que a pessoa já resolveu —
   * guardando ou dizendo "agora não". É uma decisão sobre AQUELA ocorrência,
   * não um contador: a do mês seguinte tem outro dia e volta a perguntar.
   */
  resolvidas: Record<string, DiaISO>;
};

/** O clássico do "pague-se primeiro": um décimo do que entra. */
export const PAGUE_SE_PRIMEIRO_PADRAO: PagueSePrimeiro = {
  percentual: 10,
  metaId: null,
  resolvidas: {},
};

export const PERCENTUAIS_PAGUE_SE_PRIMEIRO = [5, 10, 15, 20] as const;

/** Faixa aceita pelo reducer. Mais que metade do salário deixa de ser hábito e vira outra coisa. */
export const PERCENTUAL_PAGUE_SE_PRIMEIRO = { min: 1, max: 50 } as const;
