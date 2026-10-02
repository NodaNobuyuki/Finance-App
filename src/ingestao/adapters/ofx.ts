import { DiaISO } from '../../dominio/datas';
import { Centavos } from '../../dominio/dinheiro';
import { AdapterDeFonte, ExtratoInvalido, ExtratoLido, TransacaoBruta } from '../tipos';

/**
 * OFX genérico — 1.x (SGML) e 2.x (XML).
 *
 * Não usa parser XML: OFX 1.x é SGML, e as folhas (`<MEMO>texto`) podem vir sem
 * fechamento — o formato clássico dos bancos brasileiros. O Nubank fecha tudo;
 * os dois caminhos são o mesmo aqui, porque a leitura é por tag de abertura e
 * o valor vai até o próximo `<` ou fim de linha. Agregados (`<STMTTRN>`) são
 * sempre fechados, inclusive em SGML, e é isso que delimita cada lançamento.
 *
 * Linha ruim é contada e pulada, nunca derruba o arquivo. Só o que torna o
 * arquivo inteiro inútil lança `ExtratoInvalido`.
 */
export const adapterOFX: AdapterDeFonte<string> = {
  id: 'ofx-generico',
  ler: lerOFX,
};

function lerOFX(texto: string): ExtratoLido {
  if (!/<OFX>/i.test(texto)) {
    throw new ExtratoInvalido('Este arquivo não é um extrato OFX.');
  }

  const cartao = /<CREDITCARDMSGSRSV1>/i.test(texto);
  if (!cartao && !/<BANKMSGSRSV1>/i.test(texto)) {
    throw new ExtratoInvalido('O arquivo não traz extrato de conta nem fatura de cartão.');
  }

  // Duas contas num arquivo cairiam juntas numa conta só do app — o saldo das
  // duas ficaria errado sem nada explicando.
  if ((texto.match(/<(CC)?STMTRS>/gi) ?? []).length > 1) {
    throw new ExtratoInvalido(
      'Este arquivo traz mais de uma conta. Exporte uma conta por vez no app do banco.',
    );
  }

  // Tudo antes do primeiro lançamento: banco, conta, moeda e o período, que
  // mora dentro de `<BANKTRANLIST>`, logo antes das linhas.
  const cabecalho = folhas(texto.split(/<STMTTRN>/i)[0]);
  const moeda = cabecalho.get('CURDEF');
  if (moeda && moeda.toUpperCase() !== 'BRL') {
    throw new ExtratoInvalido(`O extrato está em ${moeda}; o app só trabalha com reais.`);
  }

  const transacoes: TransacaoBruta[] = [];
  let ignoradas = 0;
  const repeticoes = new Map<string, number>();

  // Cada pedaço depois de `<STMTTRN>`; só vale o que tem o fechamento — bloco
  // sem `</STMTTRN>` é arquivo cortado no meio, e o lançamento pode estar pela
  // metade.
  for (const pedaco of texto.split(/<STMTTRN>/i).slice(1)) {
    const fim = pedaco.search(/<\/STMTTRN>/i);
    const linha = fim < 0 ? null : lerLancamento(folhas(pedaco.slice(0, fim)), repeticoes);
    if (linha) transacoes.push(linha);
    else ignoradas += 1;
  }

  return {
    tipoDeConta: cartao ? 'cartao' : 'conta',
    banco: cabecalho.get('ORG'),
    contaExterna: cabecalho.get('ACCTID'),
    inicio: dia(cabecalho.get('DTSTART')) ?? undefined,
    fim: dia(cabecalho.get('DTEND')) ?? undefined,
    transacoes,
    ignoradas,
  };
}

function lerLancamento(
  campos: Map<string, string>,
  repeticoes: Map<string, number>,
): TransacaoBruta | null {
  const valorCentavos = centavos(campos.get('TRNAMT'));
  const ocorridoEm = dia(campos.get('DTPOSTED') ?? campos.get('DTUSER'));
  if (valorCentavos === null || ocorridoEm === null) return null;

  // MEMO é o texto longo na maioria dos bancos; NAME, o curto. O tipo é o
  // último recurso — "DEBIT" é pouco, mas é melhor que linha sem nome.
  const descricaoOriginal = campos.get('MEMO') ?? campos.get('NAME') ?? campos.get('TRNTYPE') ?? '';

  return {
    idExterno:
      campos.get('FITID') ?? hashEstavel(valorCentavos, ocorridoEm, descricaoOriginal, repeticoes),
    valorCentavos,
    ocorridoEm,
    descricaoOriginal,
    origem: 'ofx',
  };
}

/**
 * As folhas de um trecho, na primeira ocorrência de cada tag.
 *
 * `<TAG>valor` até o próximo `<` ou quebra de linha: serve a `<MEMO>x</MEMO>`
 * e a `<MEMO>x` sem fechamento. Tag de agregado não tem valor na mesma linha e
 * fica de fora.
 */
function folhas(trecho: string): Map<string, string> {
  const campos = new Map<string, string>();
  for (const [, tag, bruto] of trecho.matchAll(/<([A-Za-z0-9.]+)>([^<\r\n]*)/g)) {
    const nome = tag.toUpperCase();
    const valor = entidades(bruto).replace(/\s+/g, ' ').trim();
    if (valor && !campos.has(nome)) campos.set(nome, valor);
  }
  return campos;
}

function entidades(texto: string): string {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * `YYYYMMDDHHMMSS[-3:BRT]` → `YYYY-MM-DD`.
 *
 * Só a parte da data, no fuso que o próprio banco escreveu: é o dia que a
 * pessoa vê no app do banco. Converter para UTC empurraria uma compra das 22h
 * para o dia seguinte.
 */
export function dia(texto: string | undefined): DiaISO | null {
  const m = texto?.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  const [ano, mes, data] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, data));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== data) {
    return null;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Valor do OFX em centavos inteiros, sem passar por float.
 *
 * O padrão é ponto decimal (`-19.90`), mas há banco que manda vírgula e
 * separador de milhar. Separador seguido de 1 ou 2 dígitos no fim é decimal;
 * de exatamente 3, é milhar. `null` para o que não dá para interpretar.
 */
export function centavos(texto: string | undefined): Centavos | null {
  const m = texto?.trim().match(/^([+-])?([\d.,]+)$/);
  if (!m) return null;
  const sinal = m[1] === '-' ? -1 : 1;
  const corpo = m[2];

  const ultimo = Math.max(corpo.lastIndexOf('.'), corpo.lastIndexOf(','));
  const depois = ultimo < 0 ? '' : corpo.slice(ultimo + 1);
  const decimal = ultimo >= 0 && depois.length <= 2;
  const inteiro = decimal ? corpo.slice(0, ultimo) : corpo;
  const fracao = decimal ? depois.padEnd(2, '0') : '00';

  // O que sobrou de separador na parte inteira tem de ser milhar: grupos de 3,
  // sem zero na frente ("0.123" não é cento e vinte e três reais) e com um
  // caractere diferente do decimal ("12.345.6" não diz qual é qual).
  if (!/^(\d+|[1-9]\d{0,2}([.,]\d{3})+|)$/.test(inteiro) || !/^\d{2}$/.test(fracao)) return null;
  if (decimal && inteiro.includes(corpo[ultimo])) return null;
  const digitos = inteiro.replace(/[.,]/g, '') || '0';

  const valor = Number(digitos) * 100 + Number(fracao);
  return Number.isSafeInteger(valor) ? sinal * valor : null;
}

/**
 * Identificador para lançamento sem FITID.
 *
 * Estável entre exportações: o mesmo lançamento em dois arquivos de períodos
 * sobrepostos gera o mesmo id, e o dedupe o reconhece. Dois cafés iguais no
 * mesmo dia são lançamentos diferentes — a ordem de aparição no arquivo entra
 * na chave para não colidirem.
 */
function hashEstavel(
  valor: Centavos,
  ocorridoEm: DiaISO,
  descricao: string,
  repeticoes: Map<string, number>,
): string {
  const base = `${ocorridoEm}|${valor}|${descricao}`;
  const n = repeticoes.get(base) ?? 0;
  repeticoes.set(base, n + 1);
  return `hash:${cyrb53(`${base}|${n}`).toString(16)}`;
}

/** Hash de 53 bits, sem dependência: colisão desprezível para extrato pessoal. */
function cyrb53(texto: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
