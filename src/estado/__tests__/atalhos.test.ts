import { atalhosRapidos } from '../derivados';
import { Acao, criarReducer, dependenciasDeTeste, Estado, estadoInicial } from '../store';

function aplicar(estado: Estado, ...acoes: Acao[]): Estado {
  return acoes.reduce(criarReducer(dependenciasDeTeste()), estado);
}

describe('atalhos de registro em um toque', () => {
  it('sugere no máximo 4 categorias, com valor inteiro em centavos', () => {
    const atalhos = atalhosRapidos(estadoInicial);
    expect(atalhos.length).toBeGreaterThan(0);
    expect(atalhos.length).toBeLessThanOrEqual(4);
    for (const a of atalhos) {
      expect(Number.isInteger(a.valorCentavos)).toBe(true);
      expect(a.valorCentavos).toBeGreaterThan(0);
    }
  });

  it('põe na frente a categoria que se repete no histórico', () => {
    // Fora da semana corrente, só "saúde" aparece mais de uma vez.
    const ids = atalhosRapidos(estadoInicial).map((a) => a.categoriaId);
    expect(ids[0]).toBe('saude');
  });

  it('usa o valor habitual arredondado a R$ 5', () => {
    // Saúde teve R$ 132,40 e R$ 119,90 — ambos caem no mesmo balde de R$ 120.
    const saude = atalhosRapidos(estadoInicial).find((a) => a.categoriaId === 'saude');
    expect(saude?.valorCentavos).toBe(12000);
    expect(atalhosRapidos(estadoInicial).every((a) => a.valorCentavos % 500 === 0)).toBe(true);
  });

  it('não muda quando o usuário registra durante a semana', () => {
    const antes = atalhosRapidos(estadoInicial);
    const depois = aplicar(
      estadoInicial,
      { tipo: 'REGISTRO_RAPIDO', categoriaId: 'lazer', valorCentavos: 9900 },
      { tipo: 'REGISTRO_RAPIDO', categoriaId: 'lazer', valorCentavos: 9900 },
      { tipo: 'REGISTRO_RAPIDO', categoriaId: 'lazer', valorCentavos: 9900 },
    );
    expect(atalhosRapidos(depois)).toEqual(antes);
  });

  it('devolve lista vazia quando não há histórico', () => {
    expect(atalhosRapidos({ ...estadoInicial, transacoes: [] })).toEqual([]);
  });
});
