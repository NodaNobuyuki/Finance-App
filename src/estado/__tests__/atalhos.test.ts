import { Transacao } from '../../dominio/tipos';
import { atalhosRapidos } from '../derivados';
import { Acao, criarReducer, dependenciasDeTeste, Estado, estadoInicial } from '../store';

const gasto = (
  ocorridoEm: string,
  categoriaId: string,
  valorCentavos: number,
  texto: string,
): Transacao => ({
  id: `${ocorridoEm}-${texto}`,
  contaId: 'cartao',
  categoriaId,
  valorCentavos,
  ocorridoEm,
  descricao: texto,
  origem: 'manual',
  criadoEm: 1,
});
const comHistorico = (transacoes: Transacao[]): Estado => ({ ...estadoInicial, transacoes });

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

  it('põe na frente a categoria que se repete no histórico, no valor habitual', () => {
    // Duas idas à farmácia em semanas fechadas: R$ 132,40 e R$ 119,90 caem no
    // mesmo balde de R$ 120. O mercado aparece uma vez só e vai depois.
    const e = comHistorico([
      gasto('2026-07-20', 'saude', -13240, 'Farmácia São Paulo'),
      gasto('2026-07-27', 'saude', -11990, 'Drogaria'),
      gasto('2026-07-28', 'mercado', -15820, 'Mercado Dia'),
    ]);
    const atalhos = atalhosRapidos(e);
    expect(atalhos[0]).toEqual({ categoriaId: 'saude', valorCentavos: 12000 });
    expect(atalhos.map((a) => a.categoriaId)).toEqual(['saude', 'mercado']);
    expect(atalhos.every((a) => a.valorCentavos % 500 === 0)).toBe(true);
  });

  it('gasto recorrente não vira atalho — aluguel não é um toque ao lado do café', () => {
    // A demo tem dois meses de aluguel, academia e Netflix: são os que mais se
    // repetem, e são justamente os que não podem virar botão.
    const ids = atalhosRapidos(estadoInicial).map((a) => a.categoriaId);
    expect(ids).not.toContain('casa');
    expect(ids).not.toContain('assinaturas');
    expect(ids).not.toContain('educacao');
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
