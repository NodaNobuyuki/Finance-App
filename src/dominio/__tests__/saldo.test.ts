import { AGORA } from '../datas';
import { saldoDaConta, saldoTotal, somaPorCategoria, totalEntradas, totalSaidas } from '../saldo';
import { semente } from '../seed';
import { Conta, Transacao } from '../tipos';

/** A demo ancorada em `AGORA` — os saldos abaixo são os do protótipo. */
const demo = semente(AGORA);

function tx(contaId: string, valorCentavos: number, ocorridoEm = '2026-08-01'): Transacao {
  return {
    id: `t-${Math.random()}`,
    contaId,
    categoriaId: 'mercado',
    valorCentavos,
    ocorridoEm,
    descricao: 'teste',
    origem: 'manual',
    criadoEm: 1,
  };
}

const conta: Conta = {
  id: 'c1',
  nome: 'Teste',
  tipo: 'corrente',
  saldoInicialCentavos: 100000,
  cor: { tipo: 'hex', hex: '#000000' },
};

describe('saldoDaConta', () => {
  it('soma abertura + transações da própria conta', () => {
    expect(saldoDaConta(conta, [tx('c1', -25000), tx('c1', 5000)])).toBe(80000);
  });

  it('ignora transações de outras contas', () => {
    expect(saldoDaConta(conta, [tx('c2', -999999)])).toBe(100000);
  });

  it('sem transações, devolve a abertura', () => {
    expect(saldoDaConta(conta, [])).toBe(100000);
  });

  it('aceita saldo negativo (fatura de cartão)', () => {
    expect(saldoDaConta({ ...conta, saldoInicialCentavos: 0 }, [tx('c1', -5000)])).toBe(-5000);
  });
});

describe('saldoTotal', () => {
  it('é a soma dos saldos derivados de cada conta', () => {
    const somaPorConta = demo.contas.reduce((a, c) => a + saldoDaConta(c, demo.transacoes), 0);
    expect(saldoTotal(demo.contas, demo.transacoes)).toBe(somaPorConta);
  });

  it('reproduz os saldos que o protótipo mostrava', () => {
    const esperado: Record<string, number> = {
      carteira: 34050,
      corrente: 894215,
      cartao: -142030,
      poupanca: 462000,
    };
    for (const c of demo.contas) {
      expect(saldoDaConta(c, demo.transacoes)).toBe(esperado[c.id]);
    }
    expect(saldoTotal(demo.contas, demo.transacoes)).toBe(1248235);
  });

  it('um lançamento novo move o saldo — nunca fica dessincronizado', () => {
    const antes = saldoTotal(demo.contas, demo.transacoes);
    const depois = saldoTotal(demo.contas, [...demo.transacoes, tx('cartao', -5000)]);
    expect(depois).toBe(antes - 5000);
  });
});

describe('entradas e saídas', () => {
  it('saídas voltam como valor positivo', () => {
    expect(totalSaidas([tx('c1', -1000), tx('c1', -500), tx('c1', 300)])).toBe(1500);
    expect(totalEntradas([tx('c1', -1000), tx('c1', 300)])).toBe(300);
  });

  it('todo total é inteiro', () => {
    expect(Number.isInteger(totalSaidas(demo.transacoes))).toBe(true);
    expect(Number.isInteger(totalEntradas(demo.transacoes))).toBe(true);
  });
});

describe('somaPorCategoria', () => {
  it('agrupa só despesas, em valor positivo', () => {
    const totais = somaPorCategoria([
      tx('c1', -1000),
      tx('c1', -500),
      { ...tx('c1', 900), categoriaId: 'salario' },
    ]);
    expect(totais.mercado).toBe(1500);
    expect(totais.salario).toBeUndefined();
  });
});
