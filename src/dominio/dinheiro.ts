/**
 * Dinheiro é sempre inteiro em centavos.
 *
 * Nenhuma função deste módulo devolve float. A conversão para texto acontece
 * só aqui — a camada de apresentação consome string pronta, nunca faz conta.
 */

/** Valor monetário em centavos. Sempre inteiro, negativo = saída. */
export type Centavos = number;

const AGRUPADOR = '.';
const DECIMAL = ',';
/** Sinal de menos tipográfico (U+2212), não o hífen. */
const MENOS = '−';
/** Espaço fino inquebrável entre "R$" e o número. */
const NBSP = ' ';

function agrupar(inteiro: string): string {
  let saida = '';
  for (let i = 0; i < inteiro.length; i++) {
    if (i > 0 && (inteiro.length - i) % 3 === 0) saida += AGRUPADOR;
    saida += inteiro[i];
  }
  return saida;
}

/** `28790` → `"R$ 287,90"`. Sempre o módulo — o sinal é responsabilidade de quem chama. */
export function formatar(centavos: Centavos): string {
  const abs = Math.abs(Math.trunc(centavos));
  const inteiro = Math.floor(abs / 100).toString();
  const resto = (abs % 100).toString().padStart(2, '0');
  return `R$ ${agrupar(inteiro)}${DECIMAL}${resto}`;
}

/** `-28790` → `"− R$ 287,90"`, `1620000` → `"+ R$ 16.200,00"`. */
export function comSinal(centavos: Centavos): string {
  return `${centavos < 0 ? MENOS : '+'} ${formatar(centavos)}`;
}

/** Valor redondo, sem centavos: `2000` → `"R$ 20"`. Usado nos atalhos de registro. */
export function formatarRedondo(centavos: Centavos): string {
  return `R$${NBSP}${agrupar(Math.round(Math.abs(centavos) / 100).toString())}`;
}

/**
 * Converte a fila de dígitos do teclado numérico em centavos.
 * O teclado preenche da direita para a esquerda: `"2879"` → `2879` centavos = R$ 28,79.
 */
export function deDigitos(digitos: string): Centavos {
  const limpo = digitos.replace(/\D/g, '');
  if (!limpo) return 0;
  return parseInt(limpo, 10);
}

/** Acrescenta dígitos à fila, descartando zeros à esquerda e limitando o tamanho. */
export function empilharDigitos(atual: string, entrada: string): string {
  return (atual + entrada).replace(/^0+/, '').slice(0, 9);
}

export function removerDigito(atual: string): string {
  return atual.slice(0, -1);
}

/**
 * Lê um valor digitado à mão ("1.234,56", "1234.56", "89,9") em centavos.
 * Entrada suja é esperada — devolve 0 quando não dá para interpretar.
 */
export function deTextoLivre(texto: string): Centavos {
  const limpo = String(texto ?? '').replace(/[^0-9,.]/g, '');
  if (!limpo) return 0;

  // O último separador manda: em pt-BR é a vírgula, mas aceitamos ponto decimal.
  const ultimaVirgula = limpo.lastIndexOf(',');
  const ultimoPonto = limpo.lastIndexOf('.');
  const posDecimal = Math.max(ultimaVirgula, ultimoPonto);

  let inteiro: string;
  let fracao: string;
  if (posDecimal === -1) {
    inteiro = limpo;
    fracao = '';
  } else {
    const cauda = limpo.slice(posDecimal + 1);
    // 3+ dígitos depois do separador = separador de milhar, não decimal.
    if (cauda.length === 3 || cauda.length === 0) {
      inteiro = limpo;
      fracao = '';
    } else {
      inteiro = limpo.slice(0, posDecimal);
      fracao = cauda;
    }
  }

  const digitosInteiro = inteiro.replace(/\D/g, '') || '0';
  const digitosFracao = (fracao.replace(/\D/g, '') + '00').slice(0, 2);
  return parseInt(digitosInteiro, 10) * 100 + parseInt(digitosFracao, 10);
}

/**
 * Juros compostos sobre centavos, arredondando só no fim.
 * `taxaMensalBps` em pontos-base (88 = 0,88% a.m.) para não guardar float na taxa.
 */
export function renderPor(principal: Centavos, taxaMensalBps: number, meses: number): Centavos {
  if (principal <= 0) return 0;
  return Math.round(principal * Math.pow(1 + taxaMensalBps / 10000, meses));
}

/** Percentual inteiro de `parte` sobre `todo`, protegido contra divisão por zero. */
export function percentual(parte: Centavos, todo: Centavos): number {
  if (todo === 0) return 0;
  return Math.round((parte / todo) * 100);
}
