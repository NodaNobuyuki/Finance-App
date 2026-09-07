import { categoriasComLimite } from '../../dominio/categorias';
import { orcamento, orcamentosPorCategoria } from '../derivados';
import {
  Acao,
  criarReducer,
  dependenciasDeTeste,
  Estado,
  estadoInicial,
  estadoVazio,
} from '../store';

/**
 * Orçamento é DERIVADO dos tetos das categorias, como o saldo é derivado das
 * transações.
 *
 * Era `Estado.orcamentoMensalCentavos`, e nenhuma ação o escrevia: nascia da
 * semente da demo e ficava em zero para todo mundo que instalava o app —
 * `0% usado · R$ 0,00 de R$ 0,00`, sempre verde, para sempre. É a mesma família
 * de defeito do destino do Simulador e do `semanasEmDia` contado à mão, e o que
 * a mata é justamente parar de guardar o total.
 */

function aplicar(estado: Estado, ...acoes: Acao[]): Estado {
  return acoes.reduce(criarReducer(dependenciasDeTeste()), estado);
}

/** Define (ou apaga, com `''`) o teto de uma categoria que já existe. */
const definirTeto = (estado: Estado, categoriaId: string, digitos: string) =>
  aplicar(
    estado,
    { tipo: 'ABRIR_CATEGORIA', categoriaId },
    { tipo: 'CADASTRO_CATEGORIA_LIMITE', digitos },
    { tipo: 'SALVAR_CATEGORIA' },
  );

const gastar = (estado: Estado, categoriaId: string, valorCentavos: number) =>
  aplicar(estado, { tipo: 'REGISTRO_RAPIDO', categoriaId, valorCentavos });

const totalDosTetos = (e: Estado) =>
  categoriasComLimite(e.categorias).reduce((a, c) => a + c.limiteCentavos, 0);

describe('o teto do mês é a soma dos tetos das categorias', () => {
  it('bate com a soma, sem número guardado em lugar nenhum', () => {
    expect(orcamento(estadoInicial).total).toBe(totalDosTetos(estadoInicial));
  });

  it('sobe quando um teto é definido, e some quando ele é zerado', () => {
    const antes = orcamento(estadoInicial).total;
    const comPet = definirTeto(estadoInicial, 'lazer', '30000');
    expect(orcamento(comPet).total).toBe(antes + 30000);

    const semTeto = definirTeto(comPet, 'lazer', '');
    expect(orcamento(semTeto).total).toBe(antes);
  });

  it('cai junto com a categoria apagada', () => {
    const antes = orcamento(estadoInicial).total;
    const mercado = estadoInicial.categorias.find((c) => c.id === 'mercado')!;
    const depois = aplicar(estadoInicial, { tipo: 'APAGAR_CATEGORIA', categoriaId: 'mercado' });

    expect(orcamento(depois).total).toBe(antes - mercado.limiteCentavos);
  });

  it('quem acabou de instalar não tem teto nenhum, e a tela não finge que tem', () => {
    // O antigo `0% usado · R$ 0,00 de R$ 0,00` vivia exatamente aqui.
    const orc = orcamento(estadoVazio);
    expect(orc.total).toBe(0);
    expect(orc.gasto).toBe(0);
    expect(orc.semLimites).toBe(true);
  });
});

describe('o gasto conta só o que tem teto', () => {
  it('gasto em categoria orçada consome o orçamento', () => {
    const antes = orcamento(estadoInicial).gasto;
    const depois = gastar(estadoInicial, 'mercado', 9000);
    expect(orcamento(depois).gasto).toBe(antes + 9000);
  });

  it('gasto em categoria SEM teto não consome nada', () => {
    // Comparar a despesa inteira do mês contra a soma de alguns tetos acusaria
    // estouro de um orçamento que a pessoa nunca definiu.
    const semTeto = estadoInicial.categorias.find(
      (c) => c.tipo === 'despesa' && c.limiteCentavos === 0,
    )!;
    const antes = orcamento(estadoInicial);
    const depois = orcamento(gastar(estadoInicial, semTeto.id, 50000));

    expect(depois.gasto).toBe(antes.gasto);
    expect(depois.total).toBe(antes.total);
  });

  it('receita não entra: teto é de gasto', () => {
    const depois = aplicar(estadoInicial, {
      tipo: 'REGISTRO_RAPIDO',
      categoriaId: 'salario',
      valorCentavos: 100000,
    });
    expect(orcamento(depois).gasto).toBe(orcamento(estadoInicial).gasto);
  });
});

describe('teto por categoria', () => {
  it('lista só as categorias com teto, com o gasto de cada uma', () => {
    const linhas = orcamentosPorCategoria(estadoInicial);
    expect(linhas.map((l) => l.categoria.id)).toEqual(
      categoriasComLimite(estadoInicial.categorias).map((c) => c.id),
    );
    for (const l of linhas) expect(l.total).toBe(l.categoria.limiteCentavos);
  });

  it('a soma das linhas é o total do mês', () => {
    const linhas = orcamentosPorCategoria(estadoInicial);
    const orc = orcamento(estadoInicial);
    expect(linhas.reduce((a, l) => a + l.total, 0)).toBe(orc.total);
    expect(linhas.reduce((a, l) => a + l.gasto, 0)).toBe(orc.gasto);
  });

  it('a barra para em 100 mesmo estourada, e o nível vira estouro', () => {
    const estourada = gastar(definirTeto(estadoInicial, 'lazer', '10000'), 'lazer', 25000);
    const linha = orcamentosPorCategoria(estourada).find((l) => l.categoria.id === 'lazer')!;

    expect(linha.pctReal).toBeGreaterThan(100);
    expect(linha.pct).toBe(100);
    expect(linha.nivel).toBe('estouro');
    expect(linha.restanteLabel).toContain('acima');
  });
});

describe('o teto é do gasto, não do rótulo', () => {
  it('categoria de receita não guarda teto', () => {
    // Sem zerar na troca de tipo o limite ficaria gravado, invisível na tela, e
    // voltaria a valer sozinho quando a pessoa trocasse o tipo de volta.
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_CATEGORIA', categoriaId: 'mercado' },
      { tipo: 'CADASTRO_CATEGORIA_LIMITE', digitos: '50000' },
      { tipo: 'CADASTRO_CATEGORIA_TIPO', tipo_: 'receita' },
      { tipo: 'SALVAR_CATEGORIA' },
    );
    expect(depois.categorias.find((c) => c.id === 'mercado')!.limiteCentavos).toBe(0);
  });

  it('categoria nova nasce com o teto que a pessoa digitou', () => {
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_CATEGORIA' },
      { tipo: 'CADASTRO_CATEGORIA_NOME', valor: 'Pet' },
      { tipo: 'CADASTRO_CATEGORIA_LIMITE', digitos: '18000' },
      { tipo: 'SALVAR_CATEGORIA' },
    );
    const pet = depois.categorias.find((c) => c.nome === 'Pet')!;
    expect(pet.limiteCentavos).toBe(18000);
    expect(orcamento(depois).total).toBe(orcamento(estadoInicial).total + 18000);
  });

  it('a folha reabre com o teto que já estava gravado', () => {
    const comTeto = definirTeto(estadoInicial, 'lazer', '30000');
    const reaberta = aplicar(comTeto, { tipo: 'ABRIR_CATEGORIA', categoriaId: 'lazer' });
    expect(reaberta.cadastroCategoria.limiteDigitos).toBe('30000');
  });

  it('categoria sem teto abre com a fila vazia, não com "0"', () => {
    // Com "0" na fila, o primeiro dígito digitado viraria "0X".
    const aberta = aplicar(estadoInicial, { tipo: 'ABRIR_CATEGORIA', categoriaId: 'saude' });
    expect(aberta.cadastroCategoria.limiteDigitos).toBe('');
  });
});
