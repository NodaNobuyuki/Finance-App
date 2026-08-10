import { AGORA, diaDaSemana, inicioDaSemana, somarDias } from '../datas';
import { semente } from '../seed';

/**
 * A semente é relativa ao dia recebido. Estes testes travam as duas coisas que
 * isso precisa garantir: que o fixture antigo continua reproduzível (é nele que
 * os saldos do protótipo estão cravados) e que a demo não envelhece —
 * qualquer dia do calendário abre um app com histórico coerente.
 */

const DIAS_VARIADOS = [
  AGORA,
  '2026-01-01', // virada de ano
  '2026-03-01', // domingo
  '2026-03-02', // segunda, primeiro dia da semana
  '2027-12-31',
  '2028-02-29', // bissexto
];

describe('semente ancorada em AGORA', () => {
  it('reproduz as datas do fixture original', () => {
    const dias = semente(AGORA).transacoes.map((t) => t.ocorridoEm);
    expect([...new Set(dias)]).toEqual(['2026-08-03', '2026-08-02', '2026-08-01']);
  });

  it('os dias sem gasto caem nas 5 semanas anteriores', () => {
    // O protótipo trazia a trilha como contagens soltas (4, 4, 3, 4, 4) que não
    // correspondiam a dado nenhum. Agora ela é derivada, então a demo precisa
    // dos registros de verdade — e eles vão para trás da semana corrente, que
    // é a única que as transações da demo alcançam.
    expect(semente(AGORA).diasSemGasto).toEqual([
      '2026-06-29',
      '2026-07-01',
      '2026-07-06',
      '2026-07-07',
      '2026-07-09',
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-24',
      '2026-07-27',
      '2026-07-29',
      '2026-07-30',
    ]);
  });
});

describe('semente em qualquer dia', () => {
  it.each(DIAS_VARIADOS)('%s: nenhuma transação cai no futuro', (hoje) => {
    for (const t of semente(hoje).transacoes) expect(t.ocorridoEm <= hoje).toBe(true);
  });

  it.each(DIAS_VARIADOS)('%s: o histórico recente nunca fica vazio', (hoje) => {
    // Este é o invariante que importa: extrato e resumo sempre têm o que
    // mostrar. Note que "ter registro na SEMANA corrente" não é invariante e
    // nem deveria ser — numa segunda-feira o certo é a semana estar mesmo em
    // branco, que é quando o convite de colocar em dia faz sentido.
    const ultimos7 = semente(hoje).transacoes.filter((t) => t.ocorridoEm > somarDias(hoje, -7));
    expect(ultimos7).toHaveLength(14);
  });

  it.each(DIAS_VARIADOS)('%s: os dias sem gasto ficam no passado, fora da semana corrente', (hoje) => {
    const dias = semente(hoje).diasSemGasto;
    const estaSemana = inicioDaSemana(hoje);

    // Nenhum invade a semana corrente: a constância dela tem de sair do que a
    // pessoa registrar agora, não da semente.
    for (const d of dias) expect(d < estaSemana).toBe(true);
    // E nenhum é mais antigo do que as 5 semanas que a trilha mostra.
    for (const d of dias) expect(d >= somarDias(estaSemana, -35)).toBe(true);
    expect(new Set(dias).size).toBe(dias.length);
  });

  it.each(DIAS_VARIADOS)('%s: as 5 semanas anteriores têm todas registro', (hoje) => {
    const dias = new Set(semente(hoje).diasSemGasto);
    const estaSemana = inicioDaSemana(hoje);

    for (let semana = 1; semana <= 5; semana++) {
      const inicio = somarDias(estaSemana, -7 * semana);
      const naSemana = [...dias].filter((d) => d >= inicio && d < somarDias(inicio, 7));
      expect(diaDaSemana(inicio)).toBe(1); // toda segunda-feira
      expect(naSemana.length).toBeGreaterThan(0);
    }
  });

  it.each(DIAS_VARIADOS)('%s: o prazo das metas fica sempre no futuro', (hoje) => {
    // O prazo era texto cravado ('15 dez 2026'), então a demo abria vencida
    // depois daquela data. Agora é deslocamento a partir de `hoje`.
    for (const m of semente(hoje).metas) {
      expect(m.prazo).not.toBeNull();
      expect(m.prazo! > hoje).toBe(true);
    }
  });

  it.each(DIAS_VARIADOS)('%s: valores não dependem da data', (hoje) => {
    const total = semente(hoje).transacoes.reduce((a, t) => a + t.valorCentavos, 0);
    expect(total).toBe(semente(AGORA).transacoes.reduce((a, t) => a + t.valorCentavos, 0));
  });

  it('ids da semente são estáveis entre chamadas', () => {
    expect(semente(AGORA).transacoes.map((t) => t.id)).toEqual(
      semente('2027-05-05').transacoes.map((t) => t.id),
    );
  });
});
