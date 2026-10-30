/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { adapterOFX } from '../adapters/ofx';
import {
  diagnosticarOFX,
  formaDaData,
  formaDoFitid,
  formaDoValor,
  relatorioDoDiagnostico,
} from '../adapters/ofxDiagnostico';
import { decodificar } from '../texto';

/**
 * O diagnóstico existe para banco que o app não conhece, rodado por quem tem a
 * conta. Duas coisas não podem falhar: apontar as manias que corrompem dado
 * (FITID reaproveitado, linha de saldo, fatura não reconhecida) e nunca
 * vazar o que é da pessoa — conta, valor, descrição, FITID.
 */

const bytes = (nome: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', nome)));
const texto = (nome: string) => decodificar(bytes(nome));
/** Diagnóstico de um texto já mexido, recodificado como UTF-8. */
const diagnostico = (t: string) => diagnosticarOFX(new TextEncoder().encode(t));
const alertas = (t: string) => diagnostico(t).alertas.join('\n');

describe('extrato que o app já conhece', () => {
  it('a fatura do Nubank só alerta o FITID que a compra internacional divide com o IOF', () => {
    const d = diagnosticarOFX(bytes('nubank-cartao.ofx'));
    expect(d.fitid.reaproveitados).toBe(1);
    expect(d.alertas).toHaveLength(1);
    expect(d.alertas[0]).toContain('não é confiável para dedupe');
    expect(d.extrato).toMatchObject({ tipo: 'cartao', codigo: '260' });
    expect(d.lancamentos).toMatchObject({ blocos: 16, lidos: 16, marcadosComoTransferencia: 2 });
    expect(d.fitid.formas).toEqual([['uuid', 16]]);
  });

  it('o derivado cp1252 sem fechamento é reconhecido como tal', () => {
    const d = diagnosticarOFX(bytes('sgml-cp1252-sem-fechamento.ofx'));
    expect(d.formato).toMatchObject({
      detectado: 'cp1252',
      fimDeLinha: 'CRLF',
      folhasFechadas: false,
    });
    expect(d.alertas).toEqual([]);
  });
});

describe('nada da pessoa sai no relatório', () => {
  it.each(['nubank-cartao.ofx', 'nubank-conta.ofx', 'sgml-cp1252-sem-fechamento.ofx'])(
    '%s: nem conta, nem FITID, nem descrição, nem valor',
    (nome) => {
      const relatorio = relatorioDoDiagnostico(diagnosticarOFX(bytes(nome)));
      const t = texto(nome);
      const acctid = t.match(/<ACCTID>([^<\r\n]+)/)![1];
      expect(relatorio).not.toContain(acctid);

      for (const linha of adapterOFX.ler(t).transacoes) {
        expect(relatorio).not.toContain(linha.idExterno);
        expect(relatorio).not.toContain(linha.descricaoOriginal);
        const reais = String(Math.trunc(Math.abs(linha.valorCentavos) / 100));
        // Valor de 1 ou 2 dígitos se confunde com qualquer número do texto.
        if (reais.length >= 3) expect(relatorio).not.toContain(reais);
      }
    },
  );
});

describe('as manias que o diagnóstico tem de apontar', () => {
  const cartao = texto('nubank-cartao.ofx');
  const conta = texto('nubank-conta.ofx');

  it('FITID usado para lançamentos diferentes', () => {
    let n = 0;
    const t = cartao.replace(/<FITID>[^<]*/g, (f) => (n++ < 2 ? '<FITID>DOC-000123' : f));
    const d = diagnostico(t);
    // O grupo novo mais o da compra internacional, que o arquivo já traz.
    expect(d.fitid.reaproveitados).toBe(2);
    expect(d.alertas.join('\n')).toContain('2 FITID(s) usados para lançamentos diferentes');
  });

  it('a mesma linha impressa duas vezes', () => {
    const [bloco] = cartao.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/)!;
    const d = diagnostico(cartao.replace(bloco, `${bloco}\n${bloco}`));
    expect(d.fitid.linhasRepetidas).toBe(1);
  });

  it('lançamento sem FITID', () => {
    const d = diagnostico(cartao.replace(/<FITID>[^<]*<\/FITID>/g, ''));
    expect(d.fitid.ausentes).toBe(16);
    expect(d.alertas.join('\n')).toContain('sem FITID');
  });

  it('linha de saldo no meio dos lançamentos, com o rótulo e não o valor', () => {
    const t = conta.replace(/<MEMO>Transferência Recebida[^<\r\n]*/, '<MEMO>SALDO ANTERIOR 01/09');
    expect(alertas(t)).toContain('"SALDO ANTERIOR"');
  });

  it('pagamento da fatura escrito de outro jeito', () => {
    const t = cartao.replace(/Pagamento recebido/g, 'PAGTO EFETUADO');
    const a = alertas(t);
    expect(a).toContain('Nenhum pagamento de fatura reconhecido');
    expect(a).toContain('"PAGTO EFETUADO" ×2');
  });

  it('boleto da fatura na conta que o adapter não reconhece', () => {
    const t = conta.replace(
      /<MEMO>Transferência enviada pelo Pix[^<\r\n]*/,
      '<MEMO>PAGTO CARTAO CREDITO',
    );
    expect(alertas(t)).toContain('"PAGTO CARTAO"');
  });

  it('cartão com o sinal invertido', () => {
    const t = cartao.replace(/<TRNAMT>(-?)([\d.]+)/g, (_, menos: string, v: string) =>
      menos ? `<TRNAMT>${v}` : `<TRNAMT>-${v}`,
    );
    expect(alertas(t)).toContain('inverter o sinal');
  });

  it('cabeçalho que mente sobre o encoding', () => {
    // Troca só a declaração, nos bytes: o corpo continua cp1252. O cabeçalho é
    // ASCII, então posição no texto é posição no arquivo.
    const original = bytes('sgml-cp1252-sem-fechamento.ofx');
    const declaracao = 'ENCODING:USASCII';
    const i = decodificar(original).indexOf(declaracao);
    const mentindo = new Uint8Array([
      ...original.slice(0, i),
      ...new TextEncoder().encode('ENCODING:UTF-8'),
      ...original.slice(i + declaracao.length),
    ]);
    expect(diagnosticarOFX(mentindo).alertas.join('\n')).toContain('os bytes são cp1252');
  });

  it('bloco sem valor é contado como ignorado', () => {
    const t = cartao.replace('<TRNAMT>-12.89</TRNAMT>', '<TRNAMT>abc</TRNAMT>');
    const d = diagnostico(t);
    expect(d.lancamentos.ignorados).toBe(1);
    expect(d.valores).toContainEqual(['abc', 1]);
  });

  it('arquivo que o adapter recusa ainda sai com o formato', () => {
    const d = diagnostico(cartao.replace('<CURDEF>BRL', '<CURDEF>USD'));
    expect(d.extrato).toBeNull();
    expect(d.recusa).toContain('USD');
    expect(relatorioDoDiagnostico(d)).toContain('recusado');
  });
});

describe('formas', () => {
  it('valor: separadores e casas ficam, o tamanho some', () => {
    expect(formaDoValor('-19.90')).toBe('-9.99');
    expect(formaDoValor('1.234,56')).toBe('9.999,99');
    expect(formaDoValor('-1234.5')).toBe('-9.9');
    expect(formaDoValor('12345')).toBe('9');
    expect(formaDoValor(undefined)).toBe('(sem TRNAMT)');
  });

  it('FITID: uuid pelo nome, o resto pela sequência de classes', () => {
    expect(formaDoFitid('6f1c2b3a-1012-4037-b64c-e4228c38fb29')).toBe('uuid');
    expect(formaDoFitid('20260905001')).toBe('9×11');
    expect(formaDoFitid('DOC-000123')).toBe('A×3-9×6');
  });

  it('data: o fuso fica, os dígitos não', () => {
    expect(formaDaData('20261001050732[-3:BRT]')).toBe('99999999999999[-3:BRT]');
    expect(formaDaData('20260231')).toBe('99999999 (inválida)');
  });
});
