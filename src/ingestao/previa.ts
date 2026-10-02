import { Categoria, categoriaExisteEm } from '../dominio/categorias';
import { DiaISO, diferencaEmDias } from '../dominio/datas';
import { chaveDeRecorrencia } from '../dominio/recorrencia';
import { Conta, Transacao } from '../dominio/tipos';
import { ExtratoLido, TransacaoBruta } from './tipos';

/**
 * A prévia de uma importação: o que vai entrar, o que já estava lá e o que
 * precisa da pessoa para decidir.
 *
 * É DERIVADA, como o saldo: o estado guarda só o extrato lido, a conta de
 * destino e as escolhas da pessoa, e a prévia sai disso a cada render. Trocar a
 * conta de destino refaz a detecção de duplicatas sozinha, sem nada a invalidar.
 */

/** O que a pessoa decidiu sobre uma linha. Ausente = vale o padrão. */
export type Escolha = {
  /**
   * Para possível duplicata: `true` (padrão) é "é a mesma" — a linha não
   * entra, e o FITID passa a marcar a existente; `false` é "são diferentes".
   */
  mesma?: boolean;
  /** Liga ou desliga a leitura como transferência. Padrão: a pista do adapter. */
  transferencia?: boolean;
  /** A outra conta da transferência. Padrão: `contraparteSugerida`. */
  contraparteId?: string;
};

export type LinhaDaPrevia =
  | { situacao: 'nova'; bruta: TransacaoBruta; categoriaId: string }
  | {
      situacao: 'duplicata';
      bruta: TransacaoBruta;
      /** O lançamento já existente que parece ser este. */
      existente: Transacao;
      mesma: boolean;
      categoriaId: string;
    }
  | {
      situacao: 'transferencia';
      bruta: TransacaoBruta;
      contraparteId: string;
      /**
       * Lançamento já existente na outra conta que vira a outra ponta — o
       * boleto da fatura importado da conta antes da fatura do cartão. Sem
       * ele, a outra ponta é criada.
       */
      casaCom?: Transacao;
    };

export type Previa = {
  linhas: LinhaDaPrevia[];
  /** FITID que já está nesta conta: importar o mesmo arquivo duas vezes não duplica nada. */
  jaImportadas: number;
  ignoradas: number;
  /** Quantos lançamentos novos a confirmação cria. */
  aImportar: number;
};

/**
 * Janela de "mesmo lançamento" entre o registrado à mão e o importado. O dia
 * da compra e o dia em que o banco a lança divergem — dois dias cobre o
 * comum sem juntar compras parecidas de semanas diferentes.
 */
export const JANELA_DUPLICATA = 2;

/**
 * Janela para a linha com o MESMO TEXTO DO BANCO e outro valor — a conta de
 * luz lançada pela recorrência com o valor do mês passado. Mais larga que a de
 * duplicata porque a conta não vence no mesmo dia todo mês; segura porque o
 * texto idêntico ao do banco, numa linha sem FITID, só vem de lá.
 */
export const JANELA_MESMO_TEXTO = 5;

/** O boleto da fatura e o crédito no cartão compensam com um dia ou dois de diferença. */
export const JANELA_TRANSFERENCIA = 3;

type Estado = { transacoes: Transacao[]; contas: Conta[]; categorias: Categoria[] };

export function montarPrevia(
  extrato: ExtratoLido,
  contaId: string,
  escolhas: Record<string, Escolha>,
  e: Estado,
): Previa {
  const jaNaConta = new Set(
    e.transacoes
      .filter((t) => t.contaId === contaId && t.idExterno !== undefined)
      .map((t) => t.idExterno),
  );
  const aprendidas = categoriasAprendidas(e);
  // Uma linha existente só pode ser "a mesma" de uma linha do arquivo, e só
  // pode ser a outra ponta de uma transferência.
  const usadas = new Set<string>();

  const linhas: LinhaDaPrevia[] = [];
  let jaImportadas = 0;

  for (const bruta of extrato.transacoes) {
    // FITID repetido dentro do próprio arquivo também conta: o banco às vezes
    // repete, e o índice `(conta_id, id_externo)` recusaria a segunda.
    if (jaNaConta.has(bruta.idExterno)) {
      jaImportadas += 1;
      continue;
    }
    jaNaConta.add(bruta.idExterno);

    const escolha = escolhas[bruta.idExterno] ?? {};
    const categoriaId = aprendidas.get(chave(bruta.valorCentavos, bruta.descricaoOriginal)) ?? '';

    // Linha com FITID é outro registro do banco, não "a mesma".
    const candidata = (t: Transacao) =>
      t.contaId === contaId && t.idExterno === undefined && !usadas.has(t.id);
    const texto = chaveDeRecorrencia({ descricao: bruta.descricaoOriginal });
    const existente =
      maisProxima(
        e.transacoes,
        (t) => candidata(t) && t.valorCentavos === bruta.valorCentavos,
        bruta.ocorridoEm,
        JANELA_DUPLICATA,
      ) ??
      // Valor diferente só com o texto do banco igual: é o lançamento que a
      // recorrência fez com o valor do mês passado. Sem isto ele ficava ao lado
      // do valor real, e a conta de luz contava duas vezes no mês.
      maisProxima(
        e.transacoes,
        (t) =>
          candidata(t) &&
          t.transferenciaId === undefined &&
          Math.sign(t.valorCentavos) === Math.sign(bruta.valorCentavos) &&
          chaveDeRecorrencia(t) === texto,
        bruta.ocorridoEm,
        JANELA_MESMO_TEXTO,
      );
    if (existente && escolha.mesma !== false) {
      usadas.add(existente.id);
      linhas.push({ situacao: 'duplicata', bruta, existente, mesma: true, categoriaId });
      continue;
    }

    const contraparteId = contraparte(e.contas, contaId, escolha.contraparteId);
    const comoTransferencia = escolha.transferencia ?? bruta.natureza === 'transferencia';
    if (comoTransferencia && contraparteId) {
      const casaCom = maisProxima(
        e.transacoes,
        (t) =>
          t.contaId === contraparteId &&
          t.valorCentavos === -bruta.valorCentavos &&
          t.transferenciaId === undefined &&
          !usadas.has(t.id),
        bruta.ocorridoEm,
        JANELA_TRANSFERENCIA,
      );
      if (casaCom) usadas.add(casaCom.id);
      linhas.push({ situacao: 'transferencia', bruta, contraparteId, casaCom });
      continue;
    }

    linhas.push(
      existente
        ? { situacao: 'duplicata', bruta, existente, mesma: false, categoriaId }
        : { situacao: 'nova', bruta, categoriaId },
    );
  }

  const aImportar = linhas.filter((l) => l.situacao !== 'duplicata' || !l.mesma).length;
  return { linhas, jaImportadas, ignoradas: extrato.ignoradas, aImportar };
}

/**
 * A conta de destino mais provável: a que recebeu este extrato da última vez;
 * sem histórico, fatura vai para cartão e extrato de conta para conta
 * corrente. É só o ponto de partida — a pessoa troca na prévia.
 */
export function contaSugerida(extrato: ExtratoLido, contas: Conta[]): string {
  const lembrada = contaLembrada(extrato, contas);
  if (lembrada) return lembrada.id;
  const tipo = extrato.tipoDeConta === 'cartao' ? 'cartao' : 'corrente';
  return (contas.find((c) => c.tipo === tipo) ?? contas[0])?.id ?? '';
}

/** A conta do app que recebeu este extrato da última vez, se ainda existir. */
export function contaLembrada(extrato: ExtratoLido, contas: Conta[]): Conta | undefined {
  const { contaExterna } = extrato;
  return contaExterna === undefined ? undefined : contas.find((c) => c.idNoBanco === contaExterna);
}

/**
 * Grava de qual conta do banco vem o extrato que acabou de entrar em `contaId`.
 *
 * Uma conta do banco aponta para uma conta do app só, então o vínculo sai de
 * onde estava. Sem nada a mudar, devolve o mesmo array: a persistência compara
 * por referência e não encosta no disco.
 */
export function vincularConta(contas: Conta[], contaId: string, extrato: ExtratoLido): Conta[] {
  const { contaExterna } = extrato;
  if (contaExterna === undefined) return contas;
  if (contas.some((c) => c.id === contaId && c.idNoBanco === contaExterna)) return contas;
  return contas.map((c) => {
    if (c.id === contaId) return { ...c, idNoBanco: contaExterna };
    if (c.idNoBanco !== contaExterna) return c;
    const { idNoBanco: _solto, ...semVinculo } = c;
    return semVinculo;
  });
}

/**
 * A outra ponta da transferência: a escolhida, se ainda existir; senão, do
 * cartão sai para a conta corrente e da conta sai para o cartão — é o
 * pagamento da fatura, o caso que a pista do adapter aponta.
 */
export function contraparte(
  contas: Conta[],
  contaId: string,
  escolhida: string | undefined,
): string | undefined {
  const outras = contas.filter((c) => c.id !== contaId);
  if (escolhida && outras.some((c) => c.id === escolhida)) return escolhida;
  const destino = contas.find((c) => c.id === contaId);
  const preferida =
    destino?.tipo === 'cartao'
      ? (outras.find((c) => c.tipo === 'corrente') ?? outras.find((c) => c.tipo !== 'cartao'))
      : outras.find((c) => c.tipo === 'cartao');
  return (preferida ?? outras[0])?.id;
}

/**
 * A categoria que a pessoa deu da última vez ao mesmo texto do banco.
 *
 * Aprende do que ela fez, não de regra nossa: recategorizar uma linha
 * importada ensina a próxima importação. Texto sem histórico fica sem
 * categoria — chutar "Compras" para tudo esconderia o que falta decidir.
 */
function categoriasAprendidas(e: Estado): Map<string, string> {
  const recentes = [...e.transacoes].sort((a, b) =>
    a.ocorridoEm !== b.ocorridoEm
      ? a.ocorridoEm < b.ocorridoEm
        ? 1
        : -1
      : b.criadoEm - a.criadoEm,
  );
  const mapa = new Map<string, string>();
  for (const t of recentes) {
    if (t.transferenciaId !== undefined || !categoriaExisteEm(e.categorias, t.categoriaId))
      continue;
    for (const texto of [t.descricaoOriginal, t.descricao]) {
      if (!texto) continue;
      const k = chave(t.valorCentavos, texto);
      if (!mapa.has(k)) mapa.set(k, t.categoriaId);
    }
  }
  return mapa;
}

/** Despesa e receita com o mesmo texto são coisas diferentes ("Pix Fulano"). */
function chave(valor: number, texto: string): string {
  return `${valor < 0 ? '-' : '+'}${texto.trim().toLowerCase()}`;
}

function maisProxima(
  transacoes: Transacao[],
  serve: (t: Transacao) => boolean,
  dia: DiaISO,
  janela: number,
): Transacao | undefined {
  let melhor: Transacao | undefined;
  let menor = Infinity;
  for (const t of transacoes) {
    if (!serve(t)) continue;
    const distancia = Math.abs(diferencaEmDias(t.ocorridoEm, dia));
    if (distancia <= janela && distancia < menor) {
      melhor = t;
      menor = distancia;
    }
  }
  return melhor;
}
