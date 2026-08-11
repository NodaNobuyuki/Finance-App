import { primeiroDoMes, somarMeses } from '../../dominio/datas';
import { Transacao } from '../../dominio/tipos';
import { navegacaoDeMes, transacoesDoMesVisivel, transacoesFiltradas } from '../derivados';
import { Acao, criarReducer, dependenciasDeTeste, Estado, estadoInicial, estadoVazio } from '../store';

/**
 * O mês do Extrato.
 *
 * O cabeçalho sempre anunciou "Agosto 2026" entre duas setas, mas as setas eram
 * texto e a lista trazia o histórico inteiro: a tela prometia um recorte que
 * não existia. Estes testes travam que o recorte é real.
 */

function aplicar(estado: Estado, ...acoes: Acao[]): Estado {
  return acoes.reduce(criarReducer(dependenciasDeTeste()), estado);
}

let seq = 0;
function tx(ocorridoEm: string, valorCentavos = -1000): Transacao {
  seq += 1;
  return {
    id: `t-${seq}`,
    contaId: 'corrente',
    categoriaId: 'mercado',
    valorCentavos,
    ocorridoEm,
    descricao: 'teste',
    origem: 'manual',
    criadoEm: seq,
  };
}

/** Três meses de histórico, ancorados em AGORA (2026-08-05). */
const comHistorico: Estado = {
  ...estadoVazio,
  transacoes: [tx('2026-08-02'), tx('2026-07-15'), tx('2026-07-02'), tx('2026-06-20')],
  contas: estadoInicial.contas,
};

describe('recorte do mês', () => {
  it('a lista traz só o mês visível', () => {
    expect(transacoesDoMesVisivel(comHistorico)).toHaveLength(1);

    const julho = aplicar(comHistorico, { tipo: 'MES_VISIVEL', passo: -1 });
    expect(transacoesDoMesVisivel(julho)).toHaveLength(2);
    expect(transacoesDoMesVisivel(julho).every((t) => t.ocorridoEm.startsWith('2026-07'))).toBe(
      true,
    );
  });

  it('os filtros de conta e categoria valem dentro do mês, não sobre tudo', () => {
    const julho = aplicar(comHistorico, { tipo: 'MES_VISIVEL', passo: -1 });
    const filtrado = { ...julho, filtroCategoria: 'lazer' };
    expect(transacoesFiltradas(filtrado)).toHaveLength(0);
    expect(transacoesFiltradas(julho)).toHaveLength(2);
  });

  it('abre no mês corrente', () => {
    expect(comHistorico.mesVisivel).toBe(primeiroDoMes(comHistorico.hoje));
  });
});

describe('navegação', () => {
  it('anda para trás e para frente', () => {
    const julho = aplicar(comHistorico, { tipo: 'MES_VISIVEL', passo: -1 });
    expect(julho.mesVisivel).toBe('2026-07-01');

    const agosto = aplicar(julho, { tipo: 'MES_VISIVEL', passo: 1 });
    expect(agosto.mesVisivel).toBe('2026-08-01');
  });

  it('não passa do mês corrente — mês futuro não tem o que mostrar', () => {
    const depois = aplicar(comHistorico, { tipo: 'MES_VISIVEL', passo: 1 });
    expect(depois.mesVisivel).toBe(comHistorico.mesVisivel);
    expect(navegacaoDeMes(comHistorico).podeAvancar).toBe(false);
  });

  it('não passa do primeiro lançamento — antes disso o app não existia para a pessoa', () => {
    const junho = aplicar(
      comHistorico,
      { tipo: 'MES_VISIVEL', passo: -1 },
      { tipo: 'MES_VISIVEL', passo: -1 },
    );
    expect(junho.mesVisivel).toBe('2026-06-01');
    expect(navegacaoDeMes(junho).podeVoltar).toBe(false);

    const maio = aplicar(junho, { tipo: 'MES_VISIVEL', passo: -1 });
    expect(maio.mesVisivel).toBe('2026-06-01');
  });

  it('sem lançamento nenhum, as duas setas ficam paradas', () => {
    const nav = navegacaoDeMes(estadoVazio);
    expect(nav.podeVoltar).toBe(false);
    expect(nav.podeAvancar).toBe(false);
  });

  it('o rótulo acompanha o mês visível, não o dia de hoje', () => {
    expect(navegacaoDeMes(comHistorico).rotulo).toBe('Agosto 2026');
    const julho = aplicar(comHistorico, { tipo: 'MES_VISIVEL', passo: -1 });
    expect(navegacaoDeMes(julho).rotulo).toBe('Julho 2026');
  });
});

describe('mês visível × resto do app', () => {
  it('entrar no Extrato volta para o mês corrente', () => {
    // Reabrir a tela em março porque foi lá que a pessoa parou é desorientador.
    const julho = aplicar(comHistorico, { tipo: 'MES_VISIVEL', passo: -1 });
    const voltou = aplicar(julho, { tipo: 'IR_PARA', tela: 'extrato' });
    expect(voltou.mesVisivel).toBe(primeiroDoMes(voltou.hoje));
  });

  it('quem estava no mês corrente segue nele depois da virada do mês', () => {
    const proximoMes = '2026-09-01';
    const depois = aplicar(comHistorico, { tipo: 'DIA_MUDOU', dia: proximoMes });
    expect(depois.mesVisivel).toBe('2026-09-01');
  });

  it('quem tinha navegado para trás fica onde estava', () => {
    const julho = aplicar(comHistorico, { tipo: 'MES_VISIVEL', passo: -1 });
    const depois = aplicar(julho, { tipo: 'DIA_MUDOU', dia: '2026-09-01' });
    expect(depois.mesVisivel).toBe('2026-07-01');
  });
});

describe('somarMeses', () => {
  it('atravessa a virada do ano nos dois sentidos', () => {
    expect(somarMeses('2026-12-01', 1)).toBe('2027-01-01');
    expect(somarMeses('2026-01-01', -1)).toBe('2025-12-01');
  });

  it('anda vários meses de uma vez', () => {
    expect(somarMeses('2026-08-01', 6)).toBe('2027-02-01');
    expect(somarMeses('2026-08-01', -14)).toBe('2025-06-01');
  });

  it('sempre devolve o dia 1 — nunca precisa decidir o que fazer com fevereiro', () => {
    expect(somarMeses(primeiroDoMes('2026-01-31'), 1)).toBe('2026-02-01');
  });
});
