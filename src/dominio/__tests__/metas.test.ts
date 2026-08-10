import { AGORA, somarDias } from '../datas';
import { faltamParaMeta, guardadoDaMeta, rotuloDePrazo, totalGuardado } from '../metas';
import { Aporte, Meta } from '../tipos';

/**
 * Guardado segue a mesma regra do saldo: derivado dos eventos, nunca uma
 * coluna que alguém incrementa. Estes testes travam isso.
 */

let seq = 0;
function aporte(metaId: string, valorCentavos: number): Aporte {
  seq += 1;
  return {
    id: `ap-${seq}`,
    metaId,
    valorCentavos,
    ocorridoEm: '2026-08-05',
    origem: 'manual',
    criadoEm: seq,
  };
}

const reserva: Meta = {
  id: 'reserva',
  nome: 'Reserva',
  alvoCentavos: 1200000,
  guardadoInicialCentavos: 640000,
  prazo: null,
  cor: { tipo: 'hex', hex: '#000000' },
  icone: '',
};

const chile: Meta = { ...reserva, id: 'chile', nome: 'Chile', guardadoInicialCentavos: 320000 };

describe('guardadoDaMeta', () => {
  it('soma abertura + aportes da própria meta', () => {
    expect(guardadoDaMeta(reserva, [aporte('reserva', 10000), aporte('reserva', 5000)])).toBe(
      655000,
    );
  });

  it('ignora aportes de outras metas', () => {
    expect(guardadoDaMeta(reserva, [aporte('chile', 999999)])).toBe(640000);
  });

  it('sem aportes, devolve a abertura', () => {
    expect(guardadoDaMeta(reserva, [])).toBe(640000);
  });

  it('desfazer o aporte volta o guardado ao que era', () => {
    const a = aporte('reserva', 25000);
    const comAporte = guardadoDaMeta(reserva, [a]);
    const semAporte = guardadoDaMeta(
      reserva,
      [a].filter((x) => x.id !== a.id),
    );
    expect(comAporte).toBe(665000);
    expect(semAporte).toBe(640000);
  });
});

describe('totalGuardado', () => {
  it('é a soma dos guardados derivados de cada meta', () => {
    const aportes = [aporte('reserva', 10000), aporte('chile', 30000)];
    expect(totalGuardado([reserva, chile], aportes)).toBe(
      guardadoDaMeta(reserva, aportes) + guardadoDaMeta(chile, aportes),
    );
  });

  it('aporte órfão não infla o total — a meta sumiu, o dinheiro dela também', () => {
    const aportes = [aporte('reserva', 10000), aporte('meta-apagada', 500000)];
    expect(totalGuardado([reserva], aportes)).toBe(650000);
  });

  it('todo total é inteiro', () => {
    const total = totalGuardado([reserva, chile], [aporte('reserva', 3333)]);
    expect(Number.isInteger(total)).toBe(true);
  });
});

describe('rotuloDePrazo', () => {
  /**
   * O rótulo já foi campo gravado (`'faltam 134 dias · 15 dez 2026'`) e por isso
   * envelhecia: a meta seguia anunciando os mesmos dias meses depois. Estes
   * testes travam que ele é sempre calculado contra o dia recebido.
   */
  it('meta sem prazo diz isso, sem inventar data', () => {
    expect(rotuloDePrazo(null, AGORA)).toBe('sem prazo definido');
  });

  it('conta em dias quando está perto', () => {
    expect(rotuloDePrazo(somarDias(AGORA, 132), AGORA)).toBe('faltam 132 dias · 15 dez 2026');
    expect(rotuloDePrazo(somarDias(AGORA, 76), AGORA)).toBe('faltam 76 dias · 20 out 2026');
  });

  it('conta em meses quando está longe — 314 dias não ajuda ninguém', () => {
    expect(rotuloDePrazo(somarDias(AGORA, 314), AGORA)).toBe('faltam 10 meses · jun 2027');
  });

  it('singular no último dia', () => {
    expect(rotuloDePrazo(somarDias(AGORA, 1), AGORA)).toBe('falta 1 dia · 6 ago 2026');
    expect(rotuloDePrazo(AGORA, AGORA)).toBe('vence hoje · 5 ago 2026');
  });

  it('prazo que passou não vira contagem negativa', () => {
    expect(rotuloDePrazo(somarDias(AGORA, -3), AGORA)).toBe('prazo vencido · 2 ago 2026');
  });

  it('o mesmo prazo muda de texto conforme o dia anda', () => {
    const prazo = somarDias(AGORA, 40);
    expect(rotuloDePrazo(prazo, AGORA)).toBe('faltam 40 dias · 14 set 2026');
    expect(rotuloDePrazo(prazo, somarDias(AGORA, 39))).toBe('falta 1 dia · 14 set 2026');
    expect(rotuloDePrazo(prazo, somarDias(AGORA, 41))).toBe('prazo vencido · 14 set 2026');
  });
});

describe('faltamParaMeta', () => {
  it('nunca fica negativo quando a meta é ultrapassada', () => {
    expect(faltamParaMeta(reserva, [aporte('reserva', 9999999)])).toBe(0);
  });

  it('é o que resta até o alvo', () => {
    expect(faltamParaMeta(reserva, [aporte('reserva', 60000)])).toBe(500000);
  });
});
