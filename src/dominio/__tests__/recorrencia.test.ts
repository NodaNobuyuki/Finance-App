import { mesmoDiaNoMesSeguinte } from '../datas';
import { acumuladoDeAportes } from '../dinheiro';
import { DIAS_ATE_SUMIR, detectarRecorrencias } from '../recorrencia';
import { Transacao } from '../tipos';

/**
 * Recorrência inferida do histórico.
 *
 * O erro caro aqui é o falso positivo: o mercado de toda semana anunciado
 * como "gasto mensal" ensina a pessoa a ignorar a tela inteira. Por isso
 * metade dos casos abaixo é o que NÃO pode ser detectado.
 */

const HOJE = '2026-10-02';
let seq = 0;
const tx = (
  ocorridoEm: string,
  valorCentavos: number,
  texto: string,
  extra: Partial<Transacao> = {},
): Transacao => ({
  id: `t${++seq}`,
  contaId: 'cartao',
  categoriaId: 'assinaturas',
  valorCentavos,
  ocorridoEm,
  descricao: texto,
  descricaoOriginal: texto,
  origem: 'ofx',
  criadoEm: seq,
  ...extra,
});

describe('o que é recorrente', () => {
  it('a assinatura de todo mês, com o valor fixo e o próximo vencimento', () => {
    const [r] = detectarRecorrencias(
      [
        tx('2026-07-15', -4490, 'Streamingbr'),
        tx('2026-08-15', -4490, 'Streamingbr'),
        tx('2026-09-15', -4490, 'Streamingbr'),
      ],
      HOJE,
    );
    expect(r).toMatchObject({
      chave: 'streamingbr',
      valorCentavos: -4490,
      valorFixo: true,
      ocorrencias: 3,
      ultima: '2026-09-15',
      proxima: '2026-10-15',
    });
  });

  it('duas ocorrências bastam — quem confirma é a pessoa', () => {
    const lista = detectarRecorrencias(
      [tx('2026-08-20', -9990, 'Academia'), tx('2026-09-19', -9990, 'Academia')],
      HOJE,
    );
    expect(lista).toHaveLength(1);
  });

  it('a conta de luz, com valor que varia um pouco, entra marcada como variável', () => {
    const [r] = detectarRecorrencias(
      [tx('2026-08-10', -21370, 'Enel'), tx('2026-09-09', -18900, 'Enel')],
      HOJE,
    );
    expect(r).toMatchObject({ valorFixo: false, valorCentavos: -18900 });
  });

  it('banco que lança no dia útil seguinte não quebra a sequência', () => {
    const lista = detectarRecorrencias(
      [tx('2026-07-31', -5000, 'Seguro'), tx('2026-09-01', -5000, 'Seguro')],
      HOJE,
    );
    expect(lista).toHaveLength(1);
  });

  it('a linha renomeada continua a mesma recorrência, com o nome que a pessoa deu', () => {
    const [r] = detectarRecorrencias(
      [
        tx('2026-08-15', -4490, 'Streamingbr'),
        tx('2026-09-15', -4490, 'Streamingbr', { descricao: 'Netflix' }),
      ],
      HOJE,
    );
    expect(r).toMatchObject({ descricao: 'Netflix', textoOriginal: 'Streamingbr' });
  });

  it('a ordem é a do vencimento', () => {
    const lista = detectarRecorrencias(
      [
        tx('2026-08-20', -100, 'B'),
        tx('2026-09-20', -100, 'B'),
        tx('2026-08-05', -100, 'A'),
        tx('2026-09-05', -100, 'A'),
      ],
      HOJE,
    );
    expect(lista.map((r) => r.chave)).toEqual(['a', 'b']);
  });
});

describe('o que não é', () => {
  it('o mercado de toda semana, com o mesmo texto', () => {
    const semanal = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29'].map(
      (d) => tx(d, -15000, 'Mercado'),
    );
    expect(detectarRecorrencias(semanal, HOJE)).toEqual([]);
  });

  it('o quinzenal', () => {
    const lista = detectarRecorrencias(
      [tx('2026-09-01', -3000, 'Diarista'), tx('2026-09-15', -3000, 'Diarista')],
      HOJE,
    );
    expect(lista).toEqual([]);
  });

  it('a compra que se repetiu com valor muito diferente', () => {
    const lista = detectarRecorrencias(
      [tx('2026-08-10', -5000, 'Loja'), tx('2026-09-10', -20000, 'Loja')],
      HOJE,
    );
    expect(lista).toEqual([]);
  });

  it('a que parou: sem ocorrência há mais de 45 dias', () => {
    const lista = detectarRecorrencias(
      [tx('2026-06-10', -4490, 'Antiga'), tx('2026-07-10', -4490, 'Antiga')],
      HOJE,
    );
    expect(DIAS_ATE_SUMIR).toBe(45);
    expect(lista).toEqual([]);
  });

  it('parcela: cada mês tem um texto, e isso já basta para não juntar', () => {
    const lista = detectarRecorrencias(
      [
        tx('2026-08-10', -9000, 'Loja - Parcela 5/12'),
        tx('2026-09-10', -9000, 'Loja - Parcela 6/12'),
      ],
      HOJE,
    );
    expect(lista).toEqual([]);
  });

  it('receita e transferência — salário e aporte não são gasto', () => {
    const lista = detectarRecorrencias(
      [
        tx('2026-08-05', 680000, 'Salário'),
        tx('2026-09-05', 680000, 'Salário'),
        tx('2026-08-06', -50000, 'Reserva', { transferenciaId: 'p1' }),
        tx('2026-09-06', -50000, 'Reserva', { transferenciaId: 'p2' }),
      ],
      HOJE,
    );
    expect(lista).toEqual([]);
  });

  it('a corrida quebra no lançamento fora do ritmo: só conta o que vem depois dele', () => {
    const [r] = detectarRecorrencias(
      [
        tx('2026-07-01', -4490, 'Streamingbr'),
        tx('2026-07-20', -4490, 'Streamingbr'),
        tx('2026-08-20', -4490, 'Streamingbr'),
        tx('2026-09-20', -4490, 'Streamingbr'),
      ],
      HOJE,
    );
    expect(r.ocorrencias).toBe(3);
  });
});

describe('o mês seguinte', () => {
  it.each([
    ['2026-09-15', '2026-10-15'],
    ['2026-01-31', '2026-02-28'],
    ['2028-01-31', '2028-02-29'],
    ['2026-12-10', '2027-01-10'],
    ['2026-03-31', '2026-04-30'],
  ])('%s → %s', (de, ate) => {
    expect(mesmoDiaNoMesSeguinte(de)).toBe(ate);
  });
});

describe('custo de oportunidade de um gasto mensal', () => {
  it('sem rendimento, é a soma das parcelas', () => {
    expect(acumuladoDeAportes(4490, 0, 12)).toBe(4490 * 12);
  });

  it('rendendo, passa da soma — e é sempre centavo inteiro', () => {
    const cincoAnos = acumuladoDeAportes(4490, 88, 60);
    expect(cincoAnos).toBeGreaterThan(4490 * 60);
    expect(Number.isInteger(cincoAnos)).toBe(true);
  });

  it('nada guardado não rende nada', () => {
    expect(acumuladoDeAportes(0, 88, 60)).toBe(0);
  });
});
