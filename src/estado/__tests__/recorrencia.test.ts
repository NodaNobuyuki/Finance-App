import { DiaISO } from '../../dominio/datas';
import { Transacao } from '../../dominio/tipos';
import { montarPrevia } from '../../ingestao/previa';
import { ExtratoLido } from '../../ingestao/tipos';
import { recorrencias } from '../derivados';
import { Acao, criarReducer, dependenciasDeTeste, Estado, estadoInicial } from '../store';

/**
 * Da recorrência detectada ao lançamento que a pessoa não precisou digitar.
 *
 * O que isto trava: o lançamento feito a partir da recorrência tem de fazer a
 * recorrência andar para o mês seguinte (senão o aviso nunca some), e o mesmo
 * gasto chegando depois pelo OFX tem de ser reconhecido como o mesmo.
 */

const HOJE: DiaISO = '2026-10-16';
let n = 0;
const tx = (
  ocorridoEm: DiaISO,
  valorCentavos: number,
  texto: string,
  extra: Partial<Transacao> = {},
): Transacao => ({
  id: `h${++n}`,
  contaId: 'cartao',
  categoriaId: 'assinaturas',
  valorCentavos,
  ocorridoEm,
  descricao: texto,
  descricaoOriginal: texto,
  origem: 'ofx',
  criadoEm: n,
  ...extra,
});

/** Dois meses de streaming (fixo) e de luz (variável), ambos vencidos em `HOJE`. */
const comHistorico: Estado = {
  ...estadoInicial,
  hoje: HOJE,
  transacoes: [
    tx('2026-08-15', -4490, 'Streamingbr'),
    tx('2026-09-15', -4490, 'Streamingbr', { descricao: 'Netflix' }),
    tx('2026-08-10', -21370, 'Enel', { contaId: 'corrente', categoriaId: 'contas' }),
    tx('2026-09-10', -18900, 'Enel', { contaId: 'corrente', categoriaId: 'contas' }),
  ],
};

function sessao(inicial: Estado = comHistorico) {
  const reducer = criarReducer(dependenciasDeTeste());
  let e = inicial;
  return (...acoes: Acao[]) => (e = acoes.reduce(reducer, e));
}
const confirmar = (chave: string): Acao => ({
  tipo: 'DECIDIR_RECORRENCIA',
  chave,
  decisao: 'confirmada',
});

describe('sugestão e decisão', () => {
  it('o detectado começa como sugestão: não conta no mês nem avisa', () => {
    const r = recorrencias(comHistorico);
    expect(r.sugeridas.map((x) => x.chave)).toEqual(['enel', 'streamingbr']);
    expect(r.confirmadas).toEqual([]);
    expect(r.vencidas).toEqual([]);
    expect(r.mensalCentavos).toBe(0);
  });

  it('confirmar põe no comprometido do mês, com o custo no ano e investido', () => {
    const e = sessao()(confirmar('streamingbr'));
    const r = recorrencias(e);
    expect(r.confirmadas.map((x) => x.chave)).toEqual(['streamingbr']);
    expect(r.mensalCentavos).toBe(4490);
    expect(r.anualCentavos).toBe(4490 * 12);
    expect(r.investidoCentavos).toBeGreaterThan(4490 * 60);
    expect(r.vencidas.map((x) => x.chave)).toEqual(['streamingbr']);
  });

  it('"não é" tira de tudo, e o desfazer devolve à sugestão', () => {
    const fazer = sessao();
    const ignorada = fazer({ tipo: 'DECIDIR_RECORRENCIA', chave: 'enel', decisao: 'ignorada' });
    expect(recorrencias(ignorada).sugeridas.map((x) => x.chave)).toEqual(['streamingbr']);

    const desfeita = fazer(ignorada.toast!.acao!.acao);
    expect(recorrencias(desfeita).sugeridas.map((x) => x.chave)).toEqual(['enel', 'streamingbr']);
    expect(desfeita.decisoesDeRecorrencia).toEqual([]);
  });

  it('decidir de novo o mesmo não mexe no estado', () => {
    const fazer = sessao();
    const uma = fazer(confirmar('enel'));
    expect(fazer(confirmar('enel'))).toBe(uma);
  });
});

describe('lançar o que venceu', () => {
  it('cria o lançamento no dia do vencimento e a recorrência anda um mês', () => {
    const e = sessao()(confirmar('streamingbr'), {
      tipo: 'LANCAR_RECORRENCIA',
      chave: 'streamingbr',
    });
    const lancada = e.transacoes.find((t) => t.ocorridoEm === '2026-10-15')!;

    expect(lancada).toMatchObject({
      contaId: 'cartao',
      categoriaId: 'assinaturas',
      valorCentavos: -4490,
      origem: 'manual',
    });
    expect(lancada.idExterno).toBeUndefined();

    const streaming = recorrencias(e).confirmadas.find((x) => x.chave === 'streamingbr')!;
    expect(streaming.proxima).toBe('2026-11-15');
    expect(streaming.vencida).toBe(false);
  });

  it('a linha renomeada sai com o nome da pessoa e o texto do banco — é isso que a faz andar', () => {
    const e = sessao()(confirmar('streamingbr'), {
      tipo: 'LANCAR_RECORRENCIA',
      chave: 'streamingbr',
    });
    const lancada = e.transacoes.find((t) => t.ocorridoEm === '2026-10-15')!;
    expect(lancada.descricao).toBe('Netflix');
    expect(lancada.descricaoOriginal).toBe('Streamingbr');
  });

  it('valor fixo tem desfazer; o desfazer tira só o lançamento', () => {
    const fazer = sessao();
    const e = fazer(confirmar('streamingbr'), { tipo: 'LANCAR_RECORRENCIA', chave: 'streamingbr' });
    expect(e.toast!.acao!.rotulo).toBe('Desfazer');

    const desfeito = fazer(e.toast!.acao!.acao);
    expect(desfeito.transacoes).toHaveLength(comHistorico.transacoes.length);
    expect(recorrencias(desfeito).vencidas.map((x) => x.chave)).toEqual(['streamingbr']);
  });

  it('valor variável sai com o do mês passado e oferece ajustar', () => {
    const e = sessao()(confirmar('enel'), { tipo: 'LANCAR_RECORRENCIA', chave: 'enel' });
    const lancada = e.transacoes.find((t) => t.ocorridoEm === '2026-10-10')!;

    expect(lancada.valorCentavos).toBe(-18900);
    expect(e.toast!.acao).toEqual({
      rotulo: 'Ajustar',
      acao: { tipo: 'ABRIR_LANCAMENTO', transacaoId: lancada.id },
    });
  });

  it('sugestão não se lança, e o toque não fica calado', () => {
    const e = sessao()({ tipo: 'LANCAR_RECORRENCIA', chave: 'streamingbr' });
    expect(e.transacoes).toBe(comHistorico.transacoes);
    expect(e.toast!.texto).toBe('Nada a lançar');
  });

  it('o que ainda não venceu não se lança', () => {
    const antes = { ...comHistorico, hoje: '2026-10-05' };
    const e = sessao(antes)(confirmar('streamingbr'), {
      tipo: 'LANCAR_RECORRENCIA',
      chave: 'streamingbr',
    });
    expect(e.transacoes).toBe(antes.transacoes);
  });

  it('conta apagada desde o mês passado: o lançamento cai numa que existe', () => {
    const semCartao = {
      ...comHistorico,
      contas: comHistorico.contas.filter((c) => c.id !== 'cartao'),
    };
    const e = sessao(semCartao)(confirmar('streamingbr'), {
      tipo: 'LANCAR_RECORRENCIA',
      chave: 'streamingbr',
    });
    const lancada = e.transacoes.find((t) => t.ocorridoEm === '2026-10-15')!;
    expect(e.contas.some((c) => c.id === lancada.contaId)).toBe(true);
  });
});

describe('a demo', () => {
  it('mostra os gastos fixos como sugestão — é o modo que existe para mostrar o app', () => {
    const r = recorrencias(estadoInicial);
    expect(r.sugeridas.map((x) => x.descricao).sort()).toEqual([
      'Academia',
      'Aluguel',
      'Conta de luz',
      'Curso de inglês',
      'Netflix',
    ]);
    expect(r.sugeridas.find((x) => x.descricao === 'Conta de luz')!.valorFixo).toBe(false);
  });
});

describe('o extrato do mês chegando depois', () => {
  it('reconhece o lançamento feito pela recorrência como a mesma compra', () => {
    const e = sessao()(confirmar('streamingbr'), {
      tipo: 'LANCAR_RECORRENCIA',
      chave: 'streamingbr',
    });
    const extrato: ExtratoLido = {
      tipoDeConta: 'cartao',
      transacoes: [
        {
          idExterno: 'FITID-OUT',
          valorCentavos: -4490,
          ocorridoEm: '2026-10-16',
          descricaoOriginal: 'Streamingbr',
          origem: 'ofx',
        },
      ],
      ignoradas: 0,
    };
    const [linha] = montarPrevia(extrato, 'cartao', {}, e).linhas;
    expect(linha).toMatchObject({ situacao: 'duplicata', mesma: true });
  });

  it('a conta de luz lançada com o valor do mês passado fica com o do banco — não conta duas vezes', () => {
    const fazer = sessao();
    const lancou = fazer(confirmar('enel'), { tipo: 'LANCAR_RECORRENCIA', chave: 'enel' });
    const extrato: ExtratoLido = {
      tipoDeConta: 'conta',
      transacoes: [
        {
          idExterno: 'FITID-LUZ',
          valorCentavos: -20310,
          ocorridoEm: '2026-10-13',
          descricaoOriginal: 'Enel',
          origem: 'ofx',
        },
      ],
      ignoradas: 0,
    };
    const depois = fazer(
      { tipo: 'ABRIR_IMPORTACAO', extrato },
      { tipo: 'IMPORTACAO_CONTA', contaId: 'corrente' },
      { tipo: 'CONFIRMAR_IMPORTACAO' },
    );

    const luz = depois.transacoes.filter(
      (t) => t.ocorridoEm >= '2026-10-01' && t.descricaoOriginal === 'Enel',
    );
    expect(luz).toHaveLength(1);
    expect(luz[0]).toMatchObject({ valorCentavos: -20310, idExterno: 'FITID-LUZ' });
    expect(depois.transacoes).toHaveLength(lancou.transacoes.length);
  });
});
