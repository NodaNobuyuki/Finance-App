/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adapterOFX, centavos, dia } from '../adapters/ofx';
import { decodificar } from '../texto';
import { ExtratoInvalido } from '../tipos';

/**
 * O adapter de OFX contra extratos reais, anonimizados — ver `fixtures/LEIAME.md`.
 *
 * É aqui que mora o bug que corrompe dado sem ninguém ver: valor lido como
 * float, acento trocado por `�`, compra das 22h caindo no dia seguinte,
 * lançamento duplicado porque o id mudou entre duas exportações.
 */

const bytes = (nome: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', nome)));
const ler = (nome: string) => adapterOFX.ler(decodificar(bytes(nome)));

describe('fatura de cartão do Nubank', () => {
  const extrato = ler('nubank-cartao.ofx');

  it('é reconhecida como cartão, com banco e conta', () => {
    expect(extrato.tipoDeConta).toBe('cartao');
    expect(extrato.banco).toBe('NU PAGAMENTOS S.A.');
    expect(extrato.contaExterna).toBe('907a70c3-1012-4037-b64c-e4228c38fb29');
    expect(extrato.inicio).toBe('2026-07-18');
    expect(extrato.fim).toBe('2026-08-18');
  });

  it('lê todas as linhas, sem ignorar nenhuma', () => {
    expect(extrato.transacoes).toHaveLength(16);
    expect(extrato.ignoradas).toBe(0);
  });

  it('valores em centavos inteiros, somando exato', () => {
    // A soma é o teste de que nenhum valor passou por float: -214,45 exatos.
    expect(extrato.transacoes.every((t) => Number.isInteger(t.valorCentavos))).toBe(true);
    expect(extrato.transacoes.reduce((a, t) => a + t.valorCentavos, 0)).toBe(-21445);
  });

  it('compra é saída e pagamento da fatura é entrada', () => {
    // A convenção do Nubank já é a do app: a fatura é uma conta que deve.
    const [compra, pagamento] = extrato.transacoes;
    expect(compra).toEqual({
      idExterno: '6513270e-269e-4d37-b2a7-4de452e6b438',
      valorCentavos: -1289,
      ocorridoEm: '2026-08-17',
      descricaoOriginal: 'Streamingbr',
      origem: 'ofx',
    });
    expect(pagamento).toMatchObject({
      valorCentavos: 57976,
      descricaoOriginal: 'Pagamento recebido',
    });
  });

  it('preserva o texto do banco como veio — parcela, IOF, aspas', () => {
    const textos = extrato.transacoes.map((t) => t.descricaoOriginal);
    expect(textos).toContain('IOF de "Servico* Assinatura"');
    expect(textos).toContain('Cinema.Com - Parcela 1/2');
    expect(textos).toContain('Shopee *Lojaroupa - Parcela 6/12');
  });

  it('o pagamento da fatura vem marcado como transferência, e só ele', () => {
    // Não é receita: é o dinheiro da conta quitando o cartão.
    const marcadas = extrato.transacoes.filter((t) => t.natureza === 'transferencia');
    expect(marcadas.map((t) => t.descricaoOriginal)).toEqual([
      'Pagamento recebido',
      'Pagamento recebido',
    ]);
  });

  it('estorno não é pagamento', () => {
    const texto = decodificar(bytes('nubank-cartao.ofx')).replace(
      '<MEMO>Pagamento recebido</MEMO>',
      '<MEMO>Estorno de pagamento</MEMO>',
    );
    const marcadas = adapterOFX.ler(texto).transacoes.filter((t) => t.natureza);
    expect(marcadas).toHaveLength(1);
  });

  it('todo lançamento tem FITID próprio', () => {
    const ids = extrato.transacoes.map((t) => t.idExterno);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('conta corrente do Nubank', () => {
  const extrato = ler('nubank-conta.ofx');

  it('é reconhecida como conta', () => {
    expect(extrato.tipoDeConta).toBe('conta');
    expect(extrato.contaExterna).toBe('000000000-0');
    expect(extrato.transacoes.map((t) => t.valorCentavos)).toEqual([123456, -123456]);
  });

  it('Pix para outra pessoa não é marcado como transferência entre contas', () => {
    expect(extrato.transacoes.some((t) => t.natureza)).toBe(false);
  });

  it('o boleto da fatura saindo da conta é marcado', () => {
    const texto = decodificar(bytes('nubank-conta.ofx')).replace(
      /<MEMO>Transferência enviada pelo Pix[^<]*/,
      '<MEMO>Pagamento de fatura',
    );
    const [, boleto] = adapterOFX.ler(texto).transacoes;
    expect(boleto.natureza).toBe('transferencia');
  });

  it('lê UTF-8 com acento e o • da máscara de CPF', () => {
    // O cabeçalho deste diz UTF-8; o da fatura diz 1252 e é ASCII. Quem
    // decide é o byte, não o cabeçalho.
    const [recebida, enviada] = extrato.transacoes.map((t) => t.descricaoOriginal);
    expect(recebida).toMatch(/^Transferência Recebida - /);
    expect(recebida).toContain('ITAÚ UNIBANCO');
    expect(enviada).toContain('•••.000.000-••');
  });
});

describe('o formato clássico: cp1252, CRLF, folhas sem fechamento', () => {
  it('dá exatamente o mesmo extrato que a versão UTF-8 com fechamento', () => {
    // Mesmo conteúdo, os dois jeitos de escrever OFX. Se divergirem, um banco
    // brasileiro antigo importaria com acento quebrado ou linha faltando.
    expect(ler('sgml-cp1252-sem-fechamento.ofx')).toEqual(ler('nubank-conta.ofx'));
  });
});

describe('arquivo sujo', () => {
  const base = decodificar(bytes('nubank-cartao.ofx'));

  it('linha sem valor é pulada e contada, não derruba o resto', () => {
    const sujo = base.replace('<TRNAMT>-12.89</TRNAMT>', '<TRNAMT>abc</TRNAMT>');
    const extrato = adapterOFX.ler(sujo);
    expect(extrato.transacoes).toHaveLength(15);
    expect(extrato.ignoradas).toBe(1);
  });

  it('arquivo cortado no meio fica com as linhas inteiras', () => {
    // Download interrompido: o último lançamento pode estar pela metade.
    const cortado = base.slice(0, base.indexOf('<MEMO>Cinema.Com</MEMO>'));
    const extrato = adapterOFX.ler(cortado);
    expect(extrato.transacoes).toHaveLength(3);
    expect(extrato.ignoradas).toBe(1);
  });

  it('sem FITID, o id é um hash estável — e dois cafés iguais não colidem', () => {
    const semFitid = base.replace(/<FITID>[^<]*<\/FITID>/g, '');
    const a = adapterOFX.ler(semFitid).transacoes.map((t) => t.idExterno);
    const b = adapterOFX.ler(semFitid).transacoes.map((t) => t.idExterno);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);

    const linha = base.slice(base.indexOf('<STMTTRN>'), base.indexOf('</STMTTRN>') + 10);
    const doisIguais = semFitid.replace('<BANKTRANLIST>', `<BANKTRANLIST>\n${linha}\n${linha}`);
    const ids = adapterOFX.ler(doisIguais.replace(/<FITID>[^<]*<\/FITID>/g, '')).transacoes;
    expect(new Set(ids.map((t) => t.idExterno)).size).toBe(ids.length);
  });

  it('entidades SGML viram o caractere', () => {
    const extrato = adapterOFX.ler(base.replace('Streamingbr', 'Loja A &amp; B'));
    expect(extrato.transacoes[0].descricaoOriginal).toBe('Loja A & B');
  });
});

describe('arquivo que não serve', () => {
  const base = decodificar(bytes('nubank-cartao.ofx'));
  const recado = (texto: string) => {
    try {
      adapterOFX.ler(texto);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ExtratoInvalido);
      return (erro as Error).message;
    }
    throw new Error('deveria ter recusado');
  };

  it('não é OFX', () => {
    expect(recado('data;valor;descricao\n2026-08-01;-10,00;café')).toBe(
      'Este arquivo não é um extrato OFX.',
    );
  });

  it('moeda que não é real', () => {
    expect(recado(base.replace('<CURDEF>BRL', '<CURDEF>USD'))).toContain('só trabalha com reais');
  });

  it('mais de uma conta no mesmo arquivo', () => {
    const duas = base.replace('</CCSTMTRS>', '</CCSTMTRS><CCSTMTRS></CCSTMTRS>');
    expect(recado(duas)).toContain('mais de uma conta');
  });
});

describe('valor', () => {
  it.each([
    ['-19.90', -1990],
    ['4035.00', 403500],
    ['+19.9', 1990],
    ['-3', -300],
    ['0.01', 1],
    ['-19,90', -1990],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1.234', 123400],
  ])('%s → %i centavos', (texto, esperado) => {
    expect(centavos(texto)).toBe(esperado);
  });

  it.each(['', 'abc', '1.2.3', '12.345.6', '--1', '1e3', '0.123'])('"%s" não é valor', (texto) => {
    expect(centavos(texto)).toBeNull();
  });
});

describe('data', () => {
  it('fica no dia que o banco escreveu, sem converter fuso', () => {
    expect(dia('20260817230000[-3:BRT]')).toBe('2026-08-17');
    expect(dia('20260817')).toBe('2026-08-17');
  });

  it('data impossível não passa', () => {
    expect(dia('20260231000000')).toBeNull();
    expect(dia('2026-08-17')).toBeNull();
    expect(dia(undefined)).toBeNull();
  });
});

describe('decodificar', () => {
  it('cp1252 com acento não vira �', () => {
    // "Transferência" em cp1252: ê = 0xEA, inválido como UTF-8 solto.
    expect(decodificar(new Uint8Array([0x54, 0x72, 0xea, 0x73, 0x95]))).toBe('Três•');
  });

  it('UTF-8 com BOM perde o BOM', () => {
    expect(decodificar(new Uint8Array([0xef, 0xbb, 0xbf, 0x4f, 0x46, 0x58]))).toBe('OFX');
  });

  it('UTF-8 de 4 bytes', () => {
    expect(decodificar(new Uint8Array([0xf0, 0x9f, 0x92, 0xb0]))).toBe('💰');
  });
});
