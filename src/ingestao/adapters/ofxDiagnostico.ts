import { decodificar, encodingDetectado } from '../texto';
import { ExtratoInvalido, ExtratoLido } from '../tipos';
import { adapterOFX, dia, folhas } from './ofx';

/**
 * Raio-x de um OFX de banco que o app ainda não conhece — sem dado pessoal.
 *
 * O adapter é "genérico", mas só foi validado contra o Nubank. Cada banco novo
 * pode trazer uma mania: FITID reaproveitado, linha de saldo no meio dos
 * lançamentos, pagamento de fatura escrito de outro jeito, sinal invertido no
 * cartão. Este diagnóstico existe para quem tem a conta rodar no próprio
 * computador e mandar só o resultado, sem precisar entregar o extrato.
 *
 * O que NUNCA sai daqui: número de conta, valor, descrição inteira, FITID. Sai
 * a FORMA das coisas — `-9.99`, `9×20` — e, nos alertas, só as duas primeiras
 * palavras do texto do banco, que é onde mora "SALDO ANTERIOR" ou "PAGTO
 * FATURA" e quase nunca um nome.
 */
export type DiagnosticoOFX = {
  formato: {
    /** `1.x (SGML)` ou `2.x (XML)`, com a versão que o cabeçalho declara. */
    versao: string;
    /** `ENCODING` e `CHARSET` como o cabeçalho diz — que pode mentir. */
    declarado: string;
    detectado: ReturnType<typeof encodingDetectado>;
    fimDeLinha: 'CRLF' | 'LF' | 'misto' | 'nenhum';
    folhasFechadas: boolean;
  };
  /** `null` quando o adapter recusou o arquivo inteiro. */
  extrato: {
    tipo: ExtratoLido['tipoDeConta'];
    banco: string;
    /** `FID` / `BANKID`: o código da instituição, nunca a conta. */
    codigo: string;
    periodo: string;
  } | null;
  /** Mensagem do adapter quando o arquivo inteiro não serve. */
  recusa: string | null;
  lancamentos: {
    blocos: number;
    lidos: number;
    ignorados: number;
    entradas: number;
    saidas: number;
    marcadosComoTransferencia: number;
  };
  fitid: {
    ausentes: number;
    formas: Contagem;
    /** Grupos de FITID repetido com conteúdo diferente — o banco reaproveita. */
    reaproveitados: number;
    /** Linhas idênticas impressas mais de uma vez com o mesmo FITID. */
    linhasRepetidas: number;
  };
  tipos: Contagem;
  valores: Contagem;
  datas: Contagem;
  texto: { memo: number; name: number; osDois: number; nenhum: number };
  alertas: string[];
};

/** Forma → quantas vezes, da mais comum para a menos. */
export type Contagem = [string, number][];

export function diagnosticarOFX(bytes: Uint8Array): DiagnosticoOFX {
  const texto = decodificar(bytes);
  const cabecalho = folhas(texto.split(/<STMTTRN>/i)[0]);
  const blocos = (texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? []).map(folhas);
  const alertas: string[] = [];

  let extrato: ExtratoLido | null = null;
  let recusa: string | null = null;
  try {
    extrato = adapterOFX.ler(texto);
  } catch (erro) {
    if (!(erro instanceof ExtratoInvalido)) throw erro;
    recusa = erro.message;
    alertas.push(`O adapter recusou o arquivo: ${erro.message}`);
  }

  const formato = lerFormato(texto, bytes);
  if (formato.declarado !== 'nada' && !declaradoBate(formato.declarado, formato.detectado)) {
    alertas.push(
      `O cabeçalho diz ${formato.declarado}, mas os bytes são ${formato.detectado}. O app decide pelos bytes — conferir os acentos na prévia.`,
    );
  }

  // FITID: forma, ausência e repetição — olhando o arquivo cru, antes do
  // adapter separar os reaproveitados.
  const porFitid = new Map<string, Set<string>>();
  const linhasPorFitid = new Map<string, number>();
  let ausentes = 0;
  for (const b of blocos) {
    const fitid = b.get('FITID');
    if (!fitid) {
      ausentes += 1;
      continue;
    }
    const conteudo = [b.get('DTPOSTED'), b.get('TRNAMT'), b.get('MEMO'), b.get('NAME')].join('|');
    porFitid.set(fitid, (porFitid.get(fitid) ?? new Set()).add(conteudo));
    linhasPorFitid.set(fitid, (linhasPorFitid.get(fitid) ?? 0) + 1);
  }
  const reaproveitados = [...porFitid.values()].filter((c) => c.size > 1).length;
  const linhasRepetidas = [...porFitid.entries()].reduce(
    (soma, [fitid, conteudos]) => soma + (linhasPorFitid.get(fitid)! - conteudos.size),
    0,
  );
  if (ausentes > 0) {
    alertas.push(
      `${ausentes} lançamento(s) sem FITID: o id vira hash de data, valor e texto. Conferir se reimportar o mesmo arquivo não duplica.`,
    );
  }
  if (reaproveitados > 0) {
    alertas.push(
      `${reaproveitados} FITID(s) usados para lançamentos diferentes. O adapter separa por conteúdo, mas o FITID deste banco não é confiável para dedupe.`,
    );
  }
  if (linhasRepetidas > 0) {
    alertas.push(
      `${linhasRepetidas} linha(s) idênticas repetidas com o mesmo FITID — entram uma vez só. Se forem compras iguais de verdade, uma some.`,
    );
  }

  const lidas = extrato?.transacoes ?? [];
  const lancamentos = {
    blocos: blocos.length,
    lidos: lidas.length,
    ignorados: extrato?.ignoradas ?? 0,
    entradas: lidas.filter((t) => t.valorCentavos > 0).length,
    saidas: lidas.filter((t) => t.valorCentavos < 0).length,
    marcadosComoTransferencia: lidas.filter((t) => t.natureza === 'transferencia').length,
  };
  if (lancamentos.ignorados > 0) {
    alertas.push(
      `${lancamentos.ignorados} bloco(s) ignorados — sem valor, sem data ou cortados. Ver as formas de valor e data abaixo.`,
    );
  }

  if (extrato) alertas.push(...alertasDeConteudo(extrato));

  const usoDeTexto = { memo: 0, name: 0, osDois: 0, nenhum: 0 };
  for (const b of blocos) {
    const memo = b.has('MEMO');
    const name = b.has('NAME');
    if (memo && name) usoDeTexto.osDois += 1;
    else if (memo) usoDeTexto.memo += 1;
    else if (name) usoDeTexto.name += 1;
    else usoDeTexto.nenhum += 1;
  }
  if (usoDeTexto.osDois > 0) {
    alertas.push(
      `${usoDeTexto.osDois} lançamento(s) com MEMO e NAME: o app usa só o MEMO. Conferir se o NAME não é o texto mais útil.`,
    );
  }

  return {
    formato,
    extrato: extrato && {
      tipo: extrato.tipoDeConta,
      banco: extrato.banco ?? '(sem ORG)',
      codigo: cabecalho.get('FID') ?? cabecalho.get('BANKID') ?? '(sem FID/BANKID)',
      periodo: `${extrato.inicio ?? '?'} a ${extrato.fim ?? '?'}`,
    },
    recusa,
    lancamentos,
    fitid: {
      ausentes,
      formas: contar(
        blocos
          .map((b) => b.get('FITID'))
          .filter(definido)
          .map(formaDoFitid),
      ),
      reaproveitados,
      linhasRepetidas,
    },
    tipos: contar(blocos.map((b) => b.get('TRNTYPE') ?? '(sem TRNTYPE)')),
    valores: contar(blocos.map((b) => formaDoValor(b.get('TRNAMT')))),
    datas: contar(blocos.map((b) => formaDaData(b.get('DTPOSTED') ?? b.get('DTUSER')))),
    texto: usoDeTexto,
    alertas,
  };
}

/** O que só aparece olhando o que o adapter leu: saldo, fatura, sinal. */
function alertasDeConteudo(extrato: ExtratoLido): string[] {
  const alertas: string[] = [];
  const linhas = extrato.transacoes;

  const saldo = linhas.filter((t) => /\bsaldo\b|s\s+a\s+l\s+d\s+o/i.test(t.descricaoOriginal));
  if (saldo.length > 0) {
    alertas.push(
      `${saldo.length} linha(s) que parecem saldo, não lançamento (${rotulos(saldo)}). Entrariam como receita ou despesa.`,
    );
  }

  if (extrato.inicio && extrato.fim) {
    const fora = linhas.filter(
      (t) => t.ocorridoEm < extrato.inicio! || t.ocorridoEm > extrato.fim!,
    );
    if (fora.length > 0) {
      alertas.push(`${fora.length} lançamento(s) com data fora do período que o arquivo declara.`);
    }
  }

  const marcados = linhas.filter((t) => t.natureza === 'transferencia');
  if (extrato.tipoDeConta === 'cartao') {
    const entradasSemMarca = linhas.filter((t) => t.valorCentavos > 0 && !t.natureza);
    if (entradasSemMarca.length > 0) {
      alertas.push(
        `${entradasSemMarca.length} entrada(s) no cartão que NÃO viraram pagamento de fatura (${rotulos(entradasSemMarca)}). Estorno está certo assim; pagamento escrito de outro jeito, não.`,
      );
    }
    if (marcados.length === 0 && linhas.some((t) => t.valorCentavos > 0)) {
      alertas.push(
        'Nenhum pagamento de fatura reconhecido. Se a fatura foi paga no período, o gasto vai contar duas vezes.',
      );
    }
    const entradas = linhas.filter((t) => t.valorCentavos > 0).length;
    if (entradas > linhas.length / 2) {
      alertas.push(
        'A fatura tem mais entradas que saídas — este banco pode inverter o sinal no cartão.',
      );
    }
  } else {
    const pareceFatura = linhas.filter(
      (t) =>
        t.valorCentavos < 0 &&
        !t.natureza &&
        /cart[aã]o|fatura|cr[eé]dito/i.test(t.descricaoOriginal),
    );
    if (pareceFatura.length > 0) {
      alertas.push(
        `${pareceFatura.length} saída(s) da conta que falam de cartão/fatura e NÃO viraram transferência (${rotulos(pareceFatura)}). Se for o boleto da fatura, o adapter precisa reconhecer este texto.`,
      );
    }
  }

  return alertas;
}

function lerFormato(texto: string, bytes: Uint8Array): DiagnosticoOFX['formato'] {
  const xml = /<\?OFX\b/i.test(texto);
  const versao = xml
    ? (texto.match(/<\?OFX[^>]*VERSION="(\d+)"/i)?.[1] ?? '?')
    : (texto.match(/^VERSION:(\S+)/im)?.[1] ?? '?');
  const declarados = [
    texto.match(/^ENCODING:(\S+)/im)?.[1],
    texto.match(/^CHARSET:(\S+)/im)?.[1],
    texto.match(/<\?xml[^>]*encoding="([^"]+)"/i)?.[1],
  ].filter((d) => d && d.toUpperCase() !== 'NONE');

  const crlf = (texto.match(/\r\n/g) ?? []).length;
  const lf = (texto.match(/\n/g) ?? []).length;
  return {
    versao: `${xml ? '2.x (XML)' : '1.x (SGML)'} · VERSION ${versao}`,
    declarado: declarados.length > 0 ? declarados.join(' / ') : 'nada',
    detectado: encodingDetectado(bytes),
    fimDeLinha: lf === 0 ? 'nenhum' : crlf === lf ? 'CRLF' : crlf === 0 ? 'LF' : 'misto',
    folhasFechadas: /<\/(TRNAMT|FITID|MEMO|NAME)>/i.test(texto),
  };
}

/** O cabeçalho bate com os bytes? ASCII cabe em qualquer um dos dois. */
function declaradoBate(
  declarado: string,
  detectado: DiagnosticoOFX['formato']['detectado'],
): boolean {
  if (detectado === 'ascii') return true;
  const utf8 = /UTF-?8/i.test(declarado);
  return detectado === 'cp1252' ? !utf8 : utf8;
}

/** `6f1c…-…` → `uuid`; `20261001001` → `9×11`; o resto, pela sequência de classes. */
export function formaDoFitid(fitid: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fitid)) return 'uuid';
  const classes = fitid.replace(/[0-9]/g, '9').replace(/[A-Za-z]/g, 'A');
  return classes.replace(/(9+|A+)/g, (run) => (run.length > 1 ? `${run[0]}×${run.length}` : run));
}

/**
 * `-1.234,56` → `-9.999,99`; `-19.90` → `-9.99`; `12345` → `9`.
 *
 * A parte inteira vira um `9` só (o tamanho do valor é dado pessoal), mas os
 * separadores e as casas decimais ficam — são eles que quebram a leitura.
 */
export function formaDoValor(valor: string | undefined): string {
  if (valor === undefined) return '(sem TRNAMT)';
  return valor.trim().replace(/\d+/g, (digitos, posicao: number, todo: string) => {
    const antes = todo[posicao - 1];
    const fim = posicao + digitos.length === todo.length;
    if (antes === '.' || antes === ',')
      return fim && digitos.length <= 2 ? '9'.repeat(digitos.length) : '999';
    return '9';
  });
}

/** `20261001050732[-3:BRT]` → `99999999999999[-3:BRT]`: o fuso fica, a data some. */
export function formaDaData(data: string | undefined): string {
  if (data === undefined) return '(sem DTPOSTED)';
  const valida = dia(data) !== null ? '' : ' (inválida)';
  return data.replace(/^[\d.]+/, (d) => d.replace(/\d/g, '9')) + valida;
}

/** As duas primeiras palavras, sem dígito — "PAGTO FATURA", não "PIX FULANO DE TAL 123". */
function rotulos(linhas: { descricaoOriginal: string }[]): string {
  const vistos = contar(
    linhas.map((t) =>
      t.descricaoOriginal.replace(/\d/g, '9').split(/\s+/).slice(0, 2).join(' ').toUpperCase(),
    ),
  );
  return vistos
    .slice(0, 4)
    .map(([r, n]) => (n > 1 ? `"${r}" ×${n}` : `"${r}"`))
    .join(', ');
}

function contar(itens: string[]): Contagem {
  const mapa = new Map<string, number>();
  for (const i of itens) mapa.set(i, (mapa.get(i) ?? 0) + 1);
  return [...mapa.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

function definido<T>(x: T | undefined): x is T {
  return x !== undefined;
}

/* ── Relatório em texto ───────────────────────────────────────── */

/** O diagnóstico como texto para colar numa mensagem. */
export function relatorioDoDiagnostico(d: DiagnosticoOFX): string {
  const lista = (c: Contagem) => c.map(([forma, n]) => `${forma} ×${n}`).join(' · ') || '—';
  const linhas = [
    '── Formato',
    `   versão           ${d.formato.versao}`,
    `   encoding         declarado: ${d.formato.declarado} · bytes: ${d.formato.detectado}`,
    `   fim de linha     ${d.formato.fimDeLinha}`,
    `   folhas fechadas  ${d.formato.folhasFechadas ? 'sim' : 'não'}`,
    '── Extrato',
    ...(d.extrato
      ? [
          `   tipo             ${d.extrato.tipo === 'cartao' ? 'fatura de cartão' : 'conta'}`,
          `   banco            ${d.extrato.banco} (código ${d.extrato.codigo})`,
          `   período          ${d.extrato.periodo}`,
        ]
      : [`   recusado         ${d.recusa}`]),
    '── Lançamentos',
    `   blocos           ${d.lancamentos.blocos} · lidos ${d.lancamentos.lidos} · ignorados ${d.lancamentos.ignorados}`,
    `   sinal            ${d.lancamentos.entradas} entradas · ${d.lancamentos.saidas} saídas`,
    `   transferência    ${d.lancamentos.marcadosComoTransferencia} marcados como pagamento de fatura`,
    `   tipos            ${lista(d.tipos)}`,
    `   valores          ${lista(d.valores)}`,
    `   datas            ${lista(d.datas)}`,
    `   texto            MEMO ${d.texto.memo} · NAME ${d.texto.name} · os dois ${d.texto.osDois} · nenhum ${d.texto.nenhum}`,
    '── FITID',
    `   formas           ${lista(d.fitid.formas)}`,
    `   ausentes         ${d.fitid.ausentes}`,
    `   reaproveitados   ${d.fitid.reaproveitados}`,
    `   linhas repetidas ${d.fitid.linhasRepetidas}`,
    '── Alertas',
    ...(d.alertas.length > 0 ? d.alertas.map((a) => `   ! ${a}`) : ['   nenhum']),
  ];
  return linhas.join('\n');
}
