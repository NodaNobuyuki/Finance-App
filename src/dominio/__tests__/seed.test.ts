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

  it('corrige o histórico de semanas — o fixture cravava terças', () => {
    // O protótipo trazia 30/6, 7/7, 14/7, 21/7 e 28/7, que são TERÇAS, enquanto
    // `inicioDaSemana` sempre devolve segunda. A trilha de constância da tela
    // Hábitos rotulava as semanas um dia deslocado. Datas relativas ao início
    // da semana eliminam a chance de isso voltar.
    expect(semente(AGORA).historicoSemanas.map((h) => h.inicio)).toEqual([
      '2026-06-29',
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
      '2026-07-27',
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

  it.each(DIAS_VARIADOS)('%s: o histórico são as 5 semanas anteriores, em ordem', (hoje) => {
    const historico = semente(hoje).historicoSemanas;
    expect(historico).toHaveLength(5);
    for (const h of historico) {
      expect(diaDaSemana(h.inicio)).toBe(1); // toda segunda-feira
      expect(h.inicio < inicioDaSemana(hoje)).toBe(true);
    }
    expect(historico[4].inicio).toBe(somarDias(inicioDaSemana(hoje), -7));
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
