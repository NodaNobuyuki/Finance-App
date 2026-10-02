/**
 * Bytes de arquivo de banco → texto, sem confiar no cabeçalho.
 *
 * O cabeçalho do OFX mente: a fatura do Nubank declara `CHARSET:1252` e é
 * ASCII puro; o extrato de conta do mesmo banco é UTF-8. Banco antigo manda
 * cp1252 de verdade, e ler cp1252 como UTF-8 transforma "Transferência" em
 * "Transfer�ncia". Quem decide são os bytes: UTF-8 válido é UTF-8 (ASCII
 * incluso), qualquer outra coisa é cp1252 — texto em cp1252 com acento quase
 * nunca forma UTF-8 válido por acaso.
 *
 * Decodificação feita aqui, em JS, porque o `TextDecoder` não é garantido no
 * Hermes e porque o teste precisa exercitar exatamente o que roda no aparelho.
 */
export function decodificar(bytes: Uint8Array): string {
  const inicio = temBOM(bytes) ? 3 : 0;
  return deUTF8(bytes, inicio) ?? deCP1252(bytes);
}

function temBOM(b: Uint8Array): boolean {
  return b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
}

/** UTF-8 estrito: sequência inválida, longa demais ou surrogate devolve `null`. */
function deUTF8(b: Uint8Array, inicio: number): string | null {
  const pontos: number[] = [];
  let i = inicio;
  while (i < b.length) {
    const x = b[i];
    if (x < 0x80) {
      pontos.push(x);
      i += 1;
      continue;
    }
    let tamanho: number;
    let ponto: number;
    let minimo: number;
    if (x >= 0xc2 && x <= 0xdf) [tamanho, ponto, minimo] = [2, x & 0x1f, 0x80];
    else if (x >= 0xe0 && x <= 0xef) [tamanho, ponto, minimo] = [3, x & 0x0f, 0x800];
    else if (x >= 0xf0 && x <= 0xf4) [tamanho, ponto, minimo] = [4, x & 0x07, 0x10000];
    else return null;
    if (i + tamanho > b.length) return null;
    for (let k = 1; k < tamanho; k++) {
      const c = b[i + k];
      if ((c & 0xc0) !== 0x80) return null;
      ponto = (ponto << 6) | (c & 0x3f);
    }
    if (ponto < minimo || ponto > 0x10ffff || (ponto >= 0xd800 && ponto <= 0xdfff)) return null;
    pontos.push(ponto);
    i += tamanho;
  }
  return deCodigos(pontos);
}

/**
 * A faixa 0x80–0x9F é onde cp1252 difere de Latin-1: aspas curvas, travessão,
 * o `•` que o Nubank usa para mascarar CPF. Posição vazia mantém o byte, como
 * os navegadores fazem.
 */
const FAIXA_CP1252 = [
  0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039,
  0x0152, 0x8d, 0x017d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc,
  0x2122, 0x0161, 0x203a, 0x0153, 0x9d, 0x017e, 0x0178,
];

function deCP1252(b: Uint8Array): string {
  const pontos: number[] = new Array(b.length);
  for (let i = 0; i < b.length; i++) {
    const x = b[i];
    pontos[i] = x >= 0x80 && x <= 0x9f ? FAIXA_CP1252[x - 0x80] : x;
  }
  return deCodigos(pontos);
}

/** Em blocos: `fromCodePoint(...lista)` estoura a pilha num extrato grande. */
function deCodigos(pontos: number[]): string {
  let texto = '';
  for (let i = 0; i < pontos.length; i += 8192) {
    texto += String.fromCodePoint(...pontos.slice(i, i + 8192));
  }
  return texto;
}
