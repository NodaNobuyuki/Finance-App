import { inicioDaSemana, somarDias } from '../../dominio/datas';
import { guardadoDaMeta } from '../../dominio/metas';
import { saldoDaConta } from '../../dominio/saldo';
import { Transacao } from '../../dominio/tipos';
import { Acao, criarReducer, dependenciasDeTeste, Estado, estadoInicial } from '../store';
import { semana } from '../derivados';

/**
 * Corrigir o que já foi lançado.
 *
 * Até aqui o único caminho era o "Desfazer" do toast, que some em segundos:
 * valor digitado errado virava dado permanente, e tocar na linha só trocava a
 * categoria. Com importação de OFX chegando, linha a corrigir vai ser rotina.
 */

function aplicar(estado: Estado, ...acoes: Acao[]): Estado {
  return acoes.reduce(criarReducer(dependenciasDeTeste()), estado);
}

const hoje = estadoInicial.hoje;
const ontem = somarDias(hoje, -1);
const comum = estadoInicial.transacoes.find(
  (t) => t.valorCentavos < 0 && t.transferenciaId === undefined && t.categoriaId === 'mercado',
)!;
const achar = (e: Estado, id: string) => e.transacoes.find((t) => t.id === id);

/** Guardar na meta: cria o par de transferência com o `metaId` na entrada. */
const guardar = (e: Estado, metaId: string, digitos: string) =>
  aplicar(
    { ...e, rascunho: { ...e.rascunho, contaId: 'corrente' } },
    { tipo: 'ABRIR_MOVIMENTO_META', metaId },
    { tipo: 'DEFINIR_DIGITOS', digitos },
    { tipo: 'CONFIRMAR_MOVIMENTO_META' },
  );

const novas = (antes: Estado, depois: Estado): Transacao[] =>
  depois.transacoes.filter((t) => !antes.transacoes.some((x) => x.id === t.id));

describe('data do lançamento', () => {
  it('nasce em hoje', () => {
    const aberto = aplicar(estadoInicial, { tipo: 'ABRIR_NOVA' });
    expect(aberto.rascunho.ocorridoEm).toBe(hoje);
    expect(aberto.rascunho.id).toBeNull();
  });

  it('lançamento retroativo cai no dia escolhido e diz isso no toast', () => {
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_NOVA' },
      { tipo: 'DEFINIR_DIGITOS', digitos: '1250' },
      { tipo: 'RASCUNHO_DATA', dia: ontem },
      { tipo: 'SALVAR_TRANSACAO' },
    );
    const [tx] = novas(estadoInicial, depois);

    expect(tx.ocorridoEm).toBe(ontem);
    expect(depois.toast!.texto).toContain('ontem');
  });

  it('dia futuro é recusado', () => {
    const aberto = aplicar(estadoInicial, { tipo: 'ABRIR_NOVA' });
    expect(aplicar(aberto, { tipo: 'RASCUNHO_DATA', dia: somarDias(hoje, 1) })).toBe(aberto);
  });

  it('o próximo lançamento volta para hoje', () => {
    // A data escolhida é do lançamento, não uma preferência que gruda.
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_NOVA' },
      { tipo: 'DEFINIR_DIGITOS', digitos: '1250' },
      { tipo: 'RASCUNHO_DATA', dia: ontem },
      { tipo: 'SALVAR_TRANSACAO' },
      { tipo: 'ABRIR_NOVA' },
    );
    expect(depois.rascunho.ocorridoEm).toBe(hoje);
  });

  it('registrar um dia em aberto da semana o tira dos pendentes', () => {
    // Constância é derivada das datas: o lançamento retroativo conserta a
    // semana sozinho, sem contador para atualizar.
    const inicio = inicioDaSemana(hoje);
    const vazio: Estado = {
      ...estadoInicial,
      transacoes: estadoInicial.transacoes.filter((t) => t.ocorridoEm < inicio),
      diasSemGasto: [],
    };
    const dia = semana(vazio).pendentes.find((d) => d !== hoje)!;
    expect(dia).toBeDefined();

    const depois = aplicar(
      vazio,
      { tipo: 'ABRIR_NOVA' },
      { tipo: 'DEFINIR_DIGITOS', digitos: '900' },
      { tipo: 'RASCUNHO_DATA', dia },
      { tipo: 'SALVAR_TRANSACAO' },
    );
    expect(semana(depois).pendentes).not.toContain(dia);
  });
});

describe('editar lançamento', () => {
  const abrir = (e: Estado = estadoInicial) =>
    aplicar(e, { tipo: 'ABRIR_LANCAMENTO', transacaoId: comum.id });

  it('abre a folha de lançamento com os campos da linha', () => {
    const aberto = abrir();

    expect(aberto.folha).toEqual({ tipo: 'nova' });
    expect(aberto.rascunho).toMatchObject({
      id: comum.id,
      tipo: 'despesa',
      digitos: String(-comum.valorCentavos),
      categoriaId: comum.categoriaId,
      contaId: comum.contaId,
      ocorridoEm: comum.ocorridoEm,
    });
  });

  it('descrição preenchida pelo app volta vazia, para seguir a categoria nova', () => {
    const automatica = { ...comum, descricao: 'Mercado' };
    const e = {
      ...estadoInicial,
      transacoes: estadoInicial.transacoes.map((t) => (t.id === comum.id ? automatica : t)),
    };
    const depois = aplicar(
      abrir(e),
      { tipo: 'RASCUNHO_CATEGORIA', categoriaId: 'lazer' },
      { tipo: 'SALVAR_TRANSACAO' },
    );
    expect(achar(depois, comum.id)!.descricao).toBe('Lazer');
  });

  it('salva valor, data, conta e categoria na mesma linha', () => {
    const depois = aplicar(
      abrir(),
      { tipo: 'DEFINIR_DIGITOS', digitos: '4321' },
      { tipo: 'RASCUNHO_DATA', dia: ontem },
      { tipo: 'RASCUNHO_CONTA', contaId: 'carteira' },
      { tipo: 'RASCUNHO_CATEGORIA', categoriaId: 'lazer' },
      { tipo: 'SALVAR_TRANSACAO' },
    );
    const tx = achar(depois, comum.id)!;

    expect(depois.transacoes).toHaveLength(estadoInicial.transacoes.length);
    expect(tx).toMatchObject({
      valorCentavos: -4321,
      ocorridoEm: ontem,
      contaId: 'carteira',
      categoriaId: 'lazer',
    });
    expect(depois.folha).toBeNull();
    expect(depois.rascunho.id).toBeNull();
  });

  it('preserva id, origem, texto original, FITID e criadoEm', () => {
    // Corrigir o valor de uma linha importada não a torna manual, e o dedupe
    // continua precisando do FITID dela.
    const importada: Transacao = {
      ...comum,
      origem: 'ofx',
      idExterno: 'FITID-123',
      descricaoOriginal: 'COMPRA CARTAO MERCADO XYZ',
    };
    const e = {
      ...estadoInicial,
      transacoes: estadoInicial.transacoes.map((t) => (t.id === comum.id ? importada : t)),
    };
    const depois = aplicar(
      abrir(e),
      { tipo: 'DEFINIR_DIGITOS', digitos: '999' },
      { tipo: 'SALVAR_TRANSACAO' },
    );
    expect(achar(depois, comum.id)).toMatchObject({
      origem: 'ofx',
      idExterno: 'FITID-123',
      descricaoOriginal: 'COMPRA CARTAO MERCADO XYZ',
      criadoEm: comum.criadoEm,
      valorCentavos: -999,
    });
  });

  it('trocar despesa por receita troca o sinal', () => {
    const depois = aplicar(
      abrir(),
      { tipo: 'RASCUNHO_TIPO', valor: 'receita' },
      { tipo: 'SALVAR_TRANSACAO' },
    );
    expect(achar(depois, comum.id)!.valorCentavos).toBe(-comum.valorCentavos);
  });

  it('o saldo derivado acompanha a correção', () => {
    const conta = estadoInicial.contas.find((c) => c.id === comum.contaId)!;
    const antes = saldoDaConta(conta, estadoInicial.transacoes);
    const depois = aplicar(
      abrir(),
      { tipo: 'DEFINIR_DIGITOS', digitos: String(-comum.valorCentavos + 1000) },
      { tipo: 'SALVAR_TRANSACAO' },
    );
    expect(saldoDaConta(conta, depois.transacoes)).toBe(antes - 1000);
  });

  it('desfazer devolve a linha exatamente como era', () => {
    const editado = aplicar(
      abrir(),
      { tipo: 'DEFINIR_DIGITOS', digitos: '4321' },
      { tipo: 'RASCUNHO_DATA', dia: ontem },
      { tipo: 'SALVAR_TRANSACAO' },
    );
    expect(editado.toast!.acao!.rotulo).toBe('Desfazer');

    const desfeito = aplicar(editado, editado.toast!.acao!.acao);
    expect(achar(desfeito, comum.id)).toEqual(comum);
    expect(desfeito.transacoes).toHaveLength(estadoInicial.transacoes.length);
  });

  it('salvar sem mudar nada fecha a folha sem anunciar alteração', () => {
    const aberto = abrir();
    const depois = aplicar(aberto, { tipo: 'SALVAR_TRANSACAO' });

    expect(depois.folha).toBeNull();
    expect(depois.transacoes).toBe(aberto.transacoes);
    expect(depois.toast).toBe(aberto.toast);
  });

  it('abrir um novo lançamento depois de editar não sobrescreve a linha', () => {
    // O id da edição não pode grudar no rascunho: o próximo "Nova transação"
    // salvaria por cima da linha editada antes.
    const depois = aplicar(
      abrir(),
      { tipo: 'FECHAR_FOLHA' },
      { tipo: 'ABRIR_NOVA' },
      { tipo: 'DEFINIR_DIGITOS', digitos: '500' },
      { tipo: 'SALVAR_TRANSACAO' },
    );
    expect(achar(depois, comum.id)).toEqual(comum);
    expect(depois.transacoes).toHaveLength(estadoInicial.transacoes.length + 1);
  });

  it('tocar numa transferência abre o detalhe do par, não a edição', () => {
    const guardado = guardar(estadoInicial, 'reserva', '10000');
    const [ponta] = novas(estadoInicial, guardado);
    const depois = aplicar(guardado, { tipo: 'ABRIR_LANCAMENTO', transacaoId: ponta.id });

    expect(depois.folha).toEqual({
      tipo: 'detalheTransferencia',
      transferenciaId: ponta.transferenciaId,
    });
  });

  it('lançamento inexistente não mexe em nada', () => {
    expect(aplicar(estadoInicial, { tipo: 'ABRIR_LANCAMENTO', transacaoId: 'nao-existe' })).toBe(
      estadoInicial,
    );
  });
});

describe('apagar lançamento', () => {
  it('remove a linha e devolve o dinheiro ao saldo', () => {
    const conta = estadoInicial.contas.find((c) => c.id === comum.contaId)!;
    const depois = aplicar(estadoInicial, { tipo: 'APAGAR_TRANSACAO', transacaoId: comum.id });

    expect(achar(depois, comum.id)).toBeUndefined();
    expect(saldoDaConta(conta, depois.transacoes)).toBe(
      saldoDaConta(conta, estadoInicial.transacoes) - comum.valorCentavos,
    );
  });

  it('é desfazível pelo toast, sem modal de confirmação', () => {
    const depois = aplicar(estadoInicial, { tipo: 'APAGAR_TRANSACAO', transacaoId: comum.id });
    expect(depois.toast!.acao!.rotulo).toBe('Desfazer');

    const desfeito = aplicar(depois, depois.toast!.acao!.acao);
    expect(achar(desfeito, comum.id)).toEqual(comum);
    const ids = (e: Estado) => e.transacoes.map((t) => t.id).sort();
    expect(ids(desfeito)).toEqual(ids(estadoInicial));
  });

  it('apagar pela folha de edição fecha a folha e solta o rascunho', () => {
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_LANCAMENTO', transacaoId: comum.id },
      { tipo: 'APAGAR_TRANSACAO', transacaoId: comum.id },
    );
    expect(depois.folha).toBeNull();
    expect(depois.rascunho.id).toBeNull();
  });

  it('transferência vai embora com as duas pontas', () => {
    // Uma ponta sozinha seria dinheiro saindo de uma conta sem chegar a lugar
    // nenhum — o patrimônio mudaria sem gasto nenhum explicando.
    const guardado = guardar(estadoInicial, 'reserva', '10000');
    const [ponta] = novas(estadoInicial, guardado);
    const depois = aplicar(guardado, { tipo: 'APAGAR_TRANSACAO', transacaoId: ponta.id });

    expect(depois.transacoes).toHaveLength(estadoInicial.transacoes.length);
    expect(depois.transacoes.some((t) => t.transferenciaId === ponta.transferenciaId)).toBe(false);

    const meta = estadoInicial.metas.find((m) => m.id === 'reserva')!;
    expect(guardadoDaMeta(meta, depois.transacoes)).toBe(
      guardadoDaMeta(meta, estadoInicial.transacoes),
    );
  });

  it('desfazer devolve as duas pontas', () => {
    const guardado = guardar(estadoInicial, 'reserva', '10000');
    const [ponta] = novas(estadoInicial, guardado);
    const apagado = aplicar(guardado, { tipo: 'APAGAR_TRANSACAO', transacaoId: ponta.id });
    const desfeito = aplicar(apagado, apagado.toast!.acao!.acao);

    expect(novas(estadoInicial, desfeito)).toHaveLength(2);
  });

  it('não apaga o depósito de uma meta da qual o dinheiro já saiu', () => {
    // Guardou 100, retirou tudo: sem o depósito, a meta ficaria devendo. Uma
    // chamada só, para os dois pares saírem do mesmo gerador de ids.
    const meta = estadoInicial.metas.find((m) => m.id === 'reserva')!;
    const tudo = guardadoDaMeta(meta, estadoInicial.transacoes) + 10000;
    const retirado = aplicar(
      { ...estadoInicial, rascunho: { ...estadoInicial.rascunho, contaId: 'corrente' } },
      { tipo: 'ABRIR_MOVIMENTO_META', metaId: 'reserva' },
      { tipo: 'DEFINIR_DIGITOS', digitos: '10000' },
      { tipo: 'CONFIRMAR_MOVIMENTO_META' },
      { tipo: 'ABRIR_MOVIMENTO_META', metaId: 'reserva', retirar: true },
      { tipo: 'DEFINIR_DIGITOS', digitos: String(tudo) },
      { tipo: 'CONFIRMAR_MOVIMENTO_META' },
    );
    const deposito = novas(estadoInicial, retirado).find(
      (t) => t.metaId === 'reserva' && t.valorCentavos > 0,
    )!;
    expect(guardadoDaMeta(meta, retirado.transacoes)).toBe(0);

    const depois = aplicar(retirado, { tipo: 'APAGAR_TRANSACAO', transacaoId: deposito.id });
    expect(depois.transacoes).toBe(retirado.transacoes);
    expect(depois.toast!.texto).toContain('ficaria devendo');
    expect(depois.toast!.acao).toBeUndefined();
  });

  it('lançamento inexistente não mexe em nada', () => {
    expect(aplicar(estadoInicial, { tipo: 'APAGAR_TRANSACAO', transacaoId: 'nao-existe' })).toBe(
      estadoInicial,
    );
  });
});

describe('conta do lançamento', () => {
  /**
   * Conta pendurada no rascunho não pode virar linha fora de todo saldo. Era o
   * que acontecia em todo registro rápido depois de reabrir o app: o rascunho
   * do boot não tinha conta, e o gasto saía com `contaId` vazio.
   */
  const semConta: Estado = {
    ...estadoInicial,
    rascunho: { ...estadoInicial.rascunho, contaId: '' },
  };
  const existe = (e: Estado, contaId: string) => e.contas.some((c) => c.id === contaId);

  it('registro rápido cai numa conta que existe', () => {
    const depois = aplicar(semConta, {
      tipo: 'REGISTRO_RAPIDO',
      categoriaId: 'mercado',
      valorCentavos: 100,
    });
    const [tx] = novas(semConta, depois);
    expect(existe(depois, tx.contaId)).toBe(true);
  });

  it('lançamento pela folha cai numa conta que existe', () => {
    const depois = aplicar(
      semConta,
      { tipo: 'DEFINIR_DIGITOS', digitos: '100' },
      { tipo: 'SALVAR_TRANSACAO' },
    );
    const [tx] = novas(semConta, depois);
    expect(existe(depois, tx.contaId)).toBe(true);
    expect(depois.rascunho.contaId).toBe(tx.contaId);
  });

  it('guardar na meta sai de uma conta que existe', () => {
    const depois = aplicar(
      semConta,
      { tipo: 'ABRIR_MOVIMENTO_META', metaId: 'reserva' },
      { tipo: 'DEFINIR_DIGITOS', digitos: '100' },
      { tipo: 'CONFIRMAR_MOVIMENTO_META' },
    );
    expect(novas(semConta, depois).every((t) => existe(depois, t.contaId))).toBe(true);
  });
});
