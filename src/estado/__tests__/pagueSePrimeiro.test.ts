import { DiaISO } from '../../dominio/datas';
import { guardadoDaMeta } from '../../dominio/metas';
import { saldoDaConta, totalSaidas } from '../../dominio/saldo';
import { Transacao } from '../../dominio/tipos';
import { pagueSePrimeiroAgora, recorrencias } from '../derivados';
import { Acao, criarReducer, dependenciasDeTeste, Estado, estadoInicial } from '../store';

/**
 * Pague-se primeiro: o salário caiu, e a Home convida a guardar uma fatia
 * antes do primeiro gasto.
 *
 * O que isto trava: o convite só aparece para entrada que a pessoa confirmou,
 * some depois de resolvido e volta no mês seguinte; guardar é transferência de
 * verdade, da conta onde o salário caiu para a da meta; e desfazer devolve as
 * duas coisas — o dinheiro e o convite.
 */

const HOJE: DiaISO = '2026-10-07';
const SALARIO = 'entrada:salário acme ltda';
let n = 0;
const tx = (
  ocorridoEm: DiaISO,
  valorCentavos: number,
  texto: string,
  extra: Partial<Transacao> = {},
): Transacao => ({
  id: `h${++n}`,
  contaId: 'corrente',
  categoriaId: 'salario',
  valorCentavos,
  ocorridoEm,
  descricao: texto,
  descricaoOriginal: texto,
  origem: 'ofx',
  criadoEm: n,
  ...extra,
});

/** Dois salários, o último caído há dois dias, mais a demo para contas e metas. */
const comSalario: Estado = {
  ...estadoInicial,
  hoje: HOJE,
  transacoes: [
    tx('2026-08-05', 680000, 'Salário ACME LTDA'),
    tx('2026-09-05', 680000, 'Salário ACME LTDA'),
    tx('2026-10-05', 680000, 'Salário ACME LTDA', { descricao: 'Salário' }),
  ],
};

function sessao(inicial: Estado = comSalario) {
  const reducer = criarReducer(dependenciasDeTeste());
  let e = inicial;
  return (...acoes: Acao[]) => (e = acoes.reduce(reducer, e));
}
const confirmar: Acao = { tipo: 'DECIDIR_RECORRENCIA', chave: SALARIO, decisao: 'confirmada' };

describe('o convite', () => {
  it('só aparece para entrada confirmada — sugestão não convida', () => {
    expect(pagueSePrimeiroAgora(comSalario)).toBeNull();
    expect(recorrencias(comSalario).entradasSugeridas.map((r) => r.chave)).toEqual([SALARIO]);

    const e = sessao()(confirmar);
    expect(pagueSePrimeiroAgora(e)).toMatchObject({
      situacao: 'guardar',
      percentual: 10,
      valorCentavos: 68000,
      contaOrigemId: 'corrente',
      meta: { id: estadoInicial.metas[0].id },
    });
  });

  it('o salário fica fora do comprometido do mês', () => {
    const e = sessao()(confirmar);
    const r = recorrencias(e);
    expect(r.entradasConfirmadas.map((x) => x.chave)).toEqual([SALARIO]);
    expect(r.confirmadas).toEqual([]);
    expect(r.mensalCentavos).toBe(0);
  });

  it('passados dez dias do salário, guardar "primeiro" já não é verdade', () => {
    const e = sessao({ ...comSalario, hoje: '2026-10-16' })(confirmar);
    expect(pagueSePrimeiroAgora(e)).toBeNull();
  });

  it('o percentual troca na hora, e só dentro da faixa', () => {
    const fazer = sessao();
    let e = fazer(confirmar, { tipo: 'PAGAR_PRIMEIRO_PERCENTUAL', percentual: 15 });
    expect(pagueSePrimeiroAgora(e)).toMatchObject({ percentual: 15, valorCentavos: 102000 });

    e = fazer({ tipo: 'PAGAR_PRIMEIRO_PERCENTUAL', percentual: 80 });
    expect(e.pagueSePrimeiro.percentual).toBe(15);
    e = fazer({ tipo: 'PAGAR_PRIMEIRO_PERCENTUAL', percentual: 2.5 });
    expect(e.pagueSePrimeiro.percentual).toBe(15);
  });

  it('a meta escolhida vale; apagada, cai na primeira', () => {
    const fazer = sessao();
    let e = fazer(confirmar, { tipo: 'PAGAR_PRIMEIRO_META', metaId: 'reserva' });
    expect(pagueSePrimeiroAgora(e)).toMatchObject({ meta: { id: 'reserva' } });

    e = fazer({ tipo: 'PAGAR_PRIMEIRO_META', metaId: 'meta-que-nao-existe' });
    expect(pagueSePrimeiroAgora(e)).toMatchObject({ meta: { id: estadoInicial.metas[0].id } });
  });

  it('sem meta nenhuma, o convite existe e guardar avisa em vez de calar', () => {
    const e = sessao({ ...comSalario, metas: [] })(confirmar);
    expect(pagueSePrimeiroAgora(e)).toMatchObject({ situacao: 'guardar', meta: null });

    const depois = sessao(e)({ tipo: 'PAGAR_PRIMEIRO', chave: SALARIO });
    expect(depois.transacoes).toBe(e.transacoes);
    expect(depois.toast!.texto).toBe('Nenhuma meta para guardar');
  });
});

describe('guardar', () => {
  it('é transferência de verdade: sai de onde o salário caiu e entra na meta', () => {
    const fazer = sessao();
    const antes = fazer(confirmar, { tipo: 'PAGAR_PRIMEIRO_META', metaId: 'reserva' });
    const depois = fazer({ tipo: 'PAGAR_PRIMEIRO', chave: SALARIO });

    const conta = (e: Estado, id: string) =>
      saldoDaConta(
        e.contas.find((c) => c.id === id)!,
        e.transacoes,
      );
    const reserva = (e: Estado) =>
      guardadoDaMeta(
        e.metas.find((m) => m.id === 'reserva')!,
        e.transacoes,
      );

    expect(conta(depois, 'corrente')).toBe(conta(antes, 'corrente') - 68000);
    expect(conta(depois, 'poupanca')).toBe(conta(antes, 'poupanca') + 68000);
    expect(reserva(depois)).toBe(reserva(antes) + 68000);
    // Dinheiro mudando de lugar não é gasto.
    expect(totalSaidas(depois.transacoes)).toBe(totalSaidas(antes.transacoes));
    expect(depois.toast).toMatchObject({
      texto: 'R$ 680,00 guardados em Reserva de emergência',
      sub: '10% de Salário, antes de gastar.',
    });
  });

  it('resolvido, o convite some — e volta quando o salário seguinte cai', () => {
    const fazer = sessao();
    const e = fazer(confirmar, { tipo: 'PAGAR_PRIMEIRO', chave: SALARIO });
    expect(pagueSePrimeiroAgora(e)).toBeNull();
    expect(e.pagueSePrimeiro.resolvidas).toEqual({ [SALARIO]: '2026-10-05' });

    const novembro = {
      ...e,
      hoje: '2026-11-06',
      transacoes: [tx('2026-11-05', 680000, 'Salário ACME LTDA'), ...e.transacoes],
    };
    expect(pagueSePrimeiroAgora(novembro)).toMatchObject({ situacao: 'guardar' });
  });

  it('desfazer devolve o dinheiro e o convite', () => {
    const fazer = sessao();
    const antes = fazer(confirmar);
    const guardou = fazer({ tipo: 'PAGAR_PRIMEIRO', chave: SALARIO });
    const desfeito = fazer(guardou.toast!.acao!.acao);

    // Guardar reordena a lista por data; o que importa é não sobrar linha.
    const ids = (e: Estado) => e.transacoes.map((t) => t.id).sort();
    expect(ids(desfeito)).toEqual(ids(antes));
    expect(desfeito.pagueSePrimeiro).toEqual(antes.pagueSePrimeiro);
    expect(pagueSePrimeiroAgora(desfeito)).toMatchObject({ situacao: 'guardar' });
  });

  it('o toque repetido não guarda duas vezes', () => {
    const fazer = sessao();
    const uma = fazer(confirmar, { tipo: 'PAGAR_PRIMEIRO', chave: SALARIO });
    const duas = fazer({ tipo: 'PAGAR_PRIMEIRO', chave: SALARIO });
    expect(duas.transacoes).toBe(uma.transacoes);
  });
});

describe('agora não', () => {
  it('resolve a ocorrência sem mover dinheiro, e desfazer reabre', () => {
    const fazer = sessao();
    const antes = fazer(confirmar);
    const pulou = fazer({ tipo: 'PULAR_PAGAR_PRIMEIRO', chave: SALARIO });
    expect(pulou.transacoes).toBe(antes.transacoes);
    expect(pagueSePrimeiroAgora(pulou)).toBeNull();

    const desfeito = fazer(pulou.toast!.acao!.acao);
    expect(pagueSePrimeiroAgora(desfeito)).toMatchObject({ situacao: 'guardar' });
  });
});

describe('quem lança o salário à mão', () => {
  /** Salário de agosto e setembro; o de outubro venceu dia 5 e ninguém lançou. */
  const semOutubro: Estado = { ...comSalario, transacoes: comSalario.transacoes.slice(0, 2) };

  it('primeiro o convite é lançar; lançado, vira guardar', () => {
    const fazer = sessao(semOutubro);
    const e = fazer(confirmar);
    expect(pagueSePrimeiroAgora(e)).toMatchObject({ situacao: 'lancar' });

    const lancou = fazer({ tipo: 'LANCAR_RECORRENCIA', chave: SALARIO });
    const salario = lancou.transacoes.find((t) => t.ocorridoEm === '2026-10-05')!;
    expect(salario).toMatchObject({
      valorCentavos: 680000,
      origem: 'manual',
      descricaoOriginal: 'Salário ACME LTDA',
    });
    expect(lancou.toast!.sub).toBe('Agora guarde R$ 680,00 antes de gastar.');
    expect(pagueSePrimeiroAgora(lancou)).toMatchObject({ situacao: 'guardar' });
  });

  it('salário que não veio há mais de dez dias para de cobrar', () => {
    const e = sessao({ ...semOutubro, hoje: '2026-10-16' })(confirmar);
    expect(pagueSePrimeiroAgora(e)).toBeNull();
  });
});
