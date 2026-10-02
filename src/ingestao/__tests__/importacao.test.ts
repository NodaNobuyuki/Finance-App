/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORIA_TRANSFERENCIA } from '../../dominio/categorias';
import { saldoDaConta, saldoTotal, totalEntradas } from '../../dominio/saldo';
import { Transacao } from '../../dominio/tipos';
import { Acao, criarReducer, dependenciasDeTeste, Estado, estadoInicial } from '../../estado/store';
import { adapterOFX } from '../adapters/ofx';
import { contaSugerida, montarPrevia, vincularConta } from '../previa';
import { decodificar } from '../texto';
import { ExtratoLido } from '../tipos';

/**
 * Do extrato lido ao Extrato do app.
 *
 * Os bugs que isto trava corrompem dado em silêncio: o mesmo arquivo importado
 * duas vezes, o gasto à mão e o importado contando em dobro, e o pagamento da
 * fatura somando como receita no cartão e como despesa na conta.
 */

const texto = (nome: string) =>
  decodificar(new Uint8Array(readFileSync(join(__dirname, 'fixtures', nome))));
const cartao = adapterOFX.ler(texto('nubank-cartao.ofx'));
/** O pagamento da fatura de 14/08, visto da conta corrente. */
const contaComBoleto = adapterOFX.ler(
  texto('nubank-conta.ofx')
    .replace(/<DTPOSTED>20260915000000\[-3:BRT\]<\/DTPOSTED>\n<TRNAMT>-1234.56/, () =>
      ['<DTPOSTED>20260815000000[-3:BRT]</DTPOSTED>', '<TRNAMT>-579.76'].join('\n'),
    )
    .replace(/<MEMO>Transferência enviada pelo Pix[^<]*/, '<MEMO>Pagamento de fatura'),
);

/** Um reducer só por teste: ids não colidem entre ações. */
function sessao(inicial: Estado = estadoInicial) {
  const reducer = criarReducer(dependenciasDeTeste());
  let e = inicial;
  return {
    fazer: (...acoes: Acao[]) => {
      e = acoes.reduce(reducer, e);
      return e;
    },
    importar: (extrato: ExtratoLido, ...antes: Acao[]) => {
      e = [
        { tipo: 'ABRIR_IMPORTACAO', extrato } as Acao,
        ...antes,
        { tipo: 'CONFIRMAR_IMPORTACAO' } as Acao,
      ].reduce(reducer, e);
      return e;
    },
  };
}

const conta = (e: Estado, id: string) => e.contas.find((c) => c.id === id)!;
const novas = (antes: Estado, depois: Estado): Transacao[] =>
  depois.transacoes.filter((t) => !antes.transacoes.some((x) => x.id === t.id));

describe('importar uma fatura', () => {
  it('vai para o cartão, com cada linha guardando o texto e o FITID do banco', () => {
    const depois = sessao().importar(cartao);
    const importadas = novas(estadoInicial, depois).filter((t) => t.contaId === 'cartao');

    expect(importadas).toHaveLength(16);
    expect(importadas.every((t) => t.origem === 'ofx' && t.idExterno)).toBe(true);
    expect(importadas.map((t) => t.descricaoOriginal)).toContain('Cinema.Com - Parcela 1/2');
  });

  it('o pagamento da fatura vira transferência da conta corrente, não receita', () => {
    const depois = sessao().importar(cartao);
    const criadas = novas(estadoInicial, depois);
    const pares = criadas.filter((t) => t.transferenciaId !== undefined);

    expect(pares).toHaveLength(4);
    expect(pares.every((t) => t.categoriaId === CATEGORIA_TRANSFERENCIA)).toBe(true);
    expect(pares.filter((t) => t.contaId === 'corrente').map((t) => t.valorCentavos)).toEqual(
      expect.arrayContaining([-57976, -2587]),
    );
    // Nenhuma entrada nova no mês: as únicas linhas positivas eram pagamentos.
    expect(totalEntradas(criadas)).toBe(0);
  });

  it('o patrimônio muda só pelo que foi gasto — o pagamento soma zero', () => {
    const depois = sessao().importar(cartao);
    const gastos = cartao.transacoes
      .filter((t) => t.natureza === undefined)
      .reduce((a, t) => a + t.valorCentavos, 0);

    expect(saldoTotal(depois.contas, depois.transacoes)).toBe(
      saldoTotal(estadoInicial.contas, estadoInicial.transacoes) + gastos,
    );
    expect(saldoDaConta(conta(depois, 'corrente'), depois.transacoes)).toBe(
      saldoDaConta(conta(estadoInicial, 'corrente'), estadoInicial.transacoes) - 57976 - 2587,
    );
  });

  it('abre o Extrato no mês do que entrou, com o resumo no toast e desfazer', () => {
    const depois = sessao().importar(cartao);

    expect(depois.tela).toBe('extrato');
    expect(depois.mesVisivel).toBe('2026-08-01');
    expect(depois.folha).toBeNull();
    expect(depois.importacao).toBeNull();
    expect(depois.toast!.texto).toBe('16 lançamentos importados');
    expect(depois.toast!.sub).toContain('2 transferências');
  });

  it('desfazer devolve o estado de antes', () => {
    const s = sessao();
    const depois = s.importar(cartao);
    const desfeito = s.fazer(depois.toast!.acao!.acao);
    expect(desfeito.transacoes).toEqual(estadoInicial.transacoes);
  });

  it('o mesmo arquivo duas vezes não duplica nada', () => {
    const s = sessao();
    const uma = s.importar(cartao);
    const duas = s.importar(cartao);

    expect(duas.transacoes).toHaveLength(uma.transacoes.length);
    expect(duas.toast!.texto).toBe('Nada novo neste extrato');
  });
});

describe('possível duplicata', () => {
  const linha = cartao.transacoes[0];
  /** O mesmo gasto, lançado à mão um dia antes. */
  const comManual = (): Estado => {
    const manual: Transacao = {
      id: 'manual',
      contaId: 'cartao',
      categoriaId: 'lazer',
      valorCentavos: linha.valorCentavos,
      ocorridoEm: '2026-08-16',
      descricao: 'Streaming',
      origem: 'manual',
      criadoEm: 1,
    };
    return { ...estadoInicial, transacoes: [manual, ...estadoInicial.transacoes] };
  };

  it('a prévia aponta, e por padrão é a mesma', () => {
    const e = comManual();
    const previa = montarPrevia(cartao, 'cartao', {}, e);
    const dup = previa.linhas.find((l) => l.bruta.idExterno === linha.idExterno)!;

    expect(dup).toMatchObject({ situacao: 'duplicata', mesma: true });
    expect(previa.aImportar).toBe(15);
  });

  it('confirmar "é a mesma" não cria linha e passa o FITID à existente', () => {
    // É o que faz a próxima importação do mesmo período reconhecê-la sozinha.
    const e = comManual();
    const s = sessao(e);
    const depois = s.importar(cartao);
    const manual = depois.transacoes.find((t) => t.id === 'manual')!;

    expect(manual.idExterno).toBe(linha.idExterno);
    expect(manual.categoriaId).toBe('lazer');
    expect(novas(e, depois).some((t) => t.idExterno === linha.idExterno)).toBe(false);
    expect(s.importar(cartao).toast!.texto).toBe('Nada novo neste extrato');
  });

  it('"são diferentes" importa a linha também', () => {
    const e = comManual();
    const depois = sessao(e).importar(cartao, {
      tipo: 'IMPORTACAO_ESCOLHA',
      idExterno: linha.idExterno,
      escolha: { mesma: false },
    });
    expect(novas(e, depois).some((t) => t.idExterno === linha.idExterno)).toBe(true);
  });

  it('linha importada antes, com outro FITID, não é duplicata', () => {
    // Duas compras iguais no mesmo dia são duas compras; o banco diz isso
    // dando FITIDs diferentes.
    const e = comManual();
    const outra = { ...e, transacoes: e.transacoes.map((t) => ({ ...t, idExterno: 'outro' })) };
    const previa = montarPrevia(cartao, 'cartao', {}, outra);
    expect(previa.linhas.every((l) => l.situacao !== 'duplicata')).toBe(true);
  });

  it('fora da janela de dois dias é outra compra', () => {
    const e = comManual();
    const longe = {
      ...e,
      transacoes: e.transacoes.map((t) =>
        t.id === 'manual' ? { ...t, ocorridoEm: '2026-08-13' } : t,
      ),
    };
    const previa = montarPrevia(cartao, 'cartao', {}, longe);
    expect(previa.linhas.every((l) => l.situacao !== 'duplicata')).toBe(true);
  });
});

describe('o mesmo texto do banco com outro valor', () => {
  const linha = cartao.transacoes[0];
  /** A linha que a recorrência lançaria: o texto do banco, o valor do mês passado, sem FITID. */
  const lancada = (campos: Partial<Transacao> = {}): Estado => {
    const t: Transacao = {
      id: 'lancada',
      contaId: 'cartao',
      categoriaId: 'assinaturas',
      valorCentavos: linha.valorCentavos - 300,
      ocorridoEm: '2026-08-13',
      descricao: 'Como a pessoa chama',
      descricaoOriginal: linha.descricaoOriginal,
      origem: 'manual',
      criadoEm: 1,
      ...campos,
    };
    return { ...estadoInicial, transacoes: [t, ...estadoInicial.transacoes] };
  };
  const situacao = (e: Estado) =>
    montarPrevia(cartao, 'cartao', {}, e).linhas.find((l) => l.bruta.idExterno === linha.idExterno)!
      .situacao;

  it('é possível duplicata, e "é a mesma" fica com o valor do banco', () => {
    const e = lancada();
    expect(situacao(e)).toBe('duplicata');

    const depois = sessao(e).importar(cartao);
    const corrigida = depois.transacoes.find((t) => t.id === 'lancada')!;
    expect(corrigida).toMatchObject({
      valorCentavos: linha.valorCentavos,
      idExterno: linha.idExterno,
      descricao: 'Como a pessoa chama',
    });
    // Uma linha só com aquele FITID: a corrigida, sem gêmea ao lado.
    expect(depois.transacoes.filter((t) => t.idExterno === linha.idExterno)).toEqual([corrigida]);
    expect(depois.toast!.sub).toContain('1 com o valor corrigido');
  });

  it('a janela é de cinco dias', () => {
    expect(situacao(lancada({ ocorridoEm: '2026-08-12' }))).toBe('duplicata');
    expect(situacao(lancada({ ocorridoEm: '2026-08-11' }))).toBe('nova');
  });

  it('texto diferente com valor diferente é outra compra', () => {
    expect(situacao(lancada({ descricaoOriginal: 'Outra coisa' }))).toBe('nova');
  });

  it('linha que já veio do banco, com FITID, nunca casa pelo texto', () => {
    expect(situacao(lancada({ idExterno: 'FITID-ANTIGO' }))).toBe('nova');
  });

  it('entrada não casa com saída do mesmo texto', () => {
    expect(situacao(lancada({ valorCentavos: -linha.valorCentavos }))).toBe('nova');
  });

  it('o valor idêntico vem antes: com as duas candidatas, casa a de mesmo valor', () => {
    const e = lancada();
    const exata: Transacao = {
      ...e.transacoes[0],
      id: 'exata',
      valorCentavos: linha.valorCentavos,
      descricaoOriginal: 'Texto qualquer',
      ocorridoEm: '2026-08-17',
    };
    const previa = montarPrevia(
      cartao,
      'cartao',
      {},
      { ...e, transacoes: [exata, ...e.transacoes] },
    );
    const dup = previa.linhas.find((l) => l.bruta.idExterno === linha.idExterno)!;
    expect(dup).toMatchObject({ situacao: 'duplicata', existente: { id: 'exata' } });
  });
});

describe('as duas pontas de uma fatura, em qualquer ordem', () => {
  it('fatura primeiro, conta depois: o boleto casa com a ponta já criada', () => {
    const s = sessao();
    const comFatura = s.importar(cartao);
    const depois = s.importar(contaComBoleto);

    const doBoleto = depois.transacoes.filter((t) => t.valorCentavos === -57976);
    expect(doBoleto).toHaveLength(1);
    expect(doBoleto[0].transferenciaId).toBeDefined();
    expect(doBoleto[0].idExterno).toBe(contaComBoleto.transacoes[1].idExterno);
    // Só a transferência recebida entrou de novo.
    expect(novas(comFatura, depois)).toHaveLength(1);
  });

  it('conta primeiro, fatura depois: o pagamento recebido casa com a ponta do cartão', () => {
    const s = sessao();
    s.importar(contaComBoleto, { tipo: 'IMPORTACAO_CONTA', contaId: 'corrente' });
    const depois = s.importar(cartao);

    const doPagamento = depois.transacoes.filter(
      (t) => t.contaId === 'cartao' && t.valorCentavos === 57976,
    );
    expect(doPagamento).toHaveLength(1);
    expect(doPagamento[0].idExterno).toBe(cartao.transacoes[1].idExterno);
  });

  it('boleto importado como linha comum vira a outra ponta, sem gêmea', () => {
    const s = sessao();
    const comBoleto = s.importar(contaComBoleto, {
      tipo: 'IMPORTACAO_ESCOLHA',
      idExterno: contaComBoleto.transacoes[1].idExterno,
      escolha: { transferencia: false },
    });
    const boleto = comBoleto.transacoes.find((t) => t.valorCentavos === -57976)!;
    expect(boleto.transferenciaId).toBeUndefined();

    const depois = s.importar(cartao);
    const virou = depois.transacoes.find((t) => t.id === boleto.id)!;
    expect(virou.transferenciaId).toBeDefined();
    expect(virou.categoriaId).toBe(CATEGORIA_TRANSFERENCIA);
    expect(depois.transacoes.filter((t) => t.valorCentavos === -57976)).toHaveLength(1);
  });
});

describe('escolhas da prévia', () => {
  const pagamento = cartao.transacoes[1];

  it('desmarcar a transferência importa como linha comum', () => {
    const previa = montarPrevia(
      cartao,
      'cartao',
      { [pagamento.idExterno]: { transferencia: false } },
      estadoInicial,
    );
    expect(previa.linhas.find((l) => l.bruta === pagamento)!.situacao).toBe('nova');
  });

  it('a outra conta da transferência é escolha', () => {
    const depois = sessao().importar(cartao, {
      tipo: 'IMPORTACAO_ESCOLHA',
      idExterno: pagamento.idExterno,
      escolha: { contraparteId: 'poupanca' },
    });
    expect(
      depois.transacoes.some((t) => t.contaId === 'poupanca' && t.valorCentavos === -57976),
    ).toBe(true);
  });

  it('com uma conta só, não há transferência possível', () => {
    const umaConta = { ...estadoInicial, contas: [conta(estadoInicial, 'cartao')] };
    const previa = montarPrevia(cartao, 'cartao', {}, umaConta);
    expect(previa.linhas.every((l) => l.situacao === 'nova')).toBe(true);
  });

  it('conta sugerida: fatura no cartão, extrato na corrente', () => {
    expect(contaSugerida(cartao, estadoInicial.contas)).toBe('cartao');
    expect(contaSugerida(contaComBoleto, estadoInicial.contas)).toBe('corrente');
  });
});

describe('a conta lembrada', () => {
  /** Dois cartões: a sugestão pelo tipo erra um deles todo mês. */
  const doisCartoes: Estado = {
    ...estadoInicial,
    contas: [
      ...estadoInicial.contas,
      { ...conta(estadoInicial, 'cartao'), id: 'cartao-2', nome: 'Outro cartão' },
    ],
  };
  const abrir = (e: Estado) =>
    criarReducer(dependenciasDeTeste())(e, { tipo: 'ABRIR_IMPORTACAO', extrato: cartao });

  it('a próxima importação do mesmo extrato abre na conta escolhida', () => {
    const s = sessao(doisCartoes);
    expect(abrir(doisCartoes).importacao!.contaId).toBe('cartao');

    const depois = s.importar(cartao, { tipo: 'IMPORTACAO_CONTA', contaId: 'cartao-2' });

    expect(conta(depois, 'cartao-2').idNoBanco).toBe(cartao.contaExterna);
    expect(abrir(depois).importacao!.contaId).toBe('cartao-2');
  });

  it('a conta do banco aponta para uma conta do app só: o vínculo muda de lugar', () => {
    const s = sessao(doisCartoes);
    s.importar(cartao, { tipo: 'IMPORTACAO_CONTA', contaId: 'cartao-2' });
    const depois = s.importar(cartao, { tipo: 'IMPORTACAO_CONTA', contaId: 'cartao' });

    expect(conta(depois, 'cartao').idNoBanco).toBe(cartao.contaExterna);
    expect('idNoBanco' in conta(depois, 'cartao-2')).toBe(false);
  });

  it('lembra mesmo quando nada novo entra — o caso de quem importou antes da v10', () => {
    const s = sessao();
    const importado = s.importar(cartao);
    const semVinculo = sessao({
      ...importado,
      contas: importado.contas.map(({ idNoBanco: _, ...c }) => c),
    });

    const depois = semVinculo.importar(cartao);

    expect(depois.toast!.texto).toBe('Nada novo neste extrato');
    expect(conta(depois, 'cartao').idNoBanco).toBe(cartao.contaExterna);
  });

  it('conta apagada leva o vínculo junto, e a sugestão volta a ser pelo tipo', () => {
    const s = sessao(doisCartoes);
    s.importar(cartao, { tipo: 'IMPORTACAO_CONTA', contaId: 'cartao-2' });
    const depois = s.fazer({ tipo: 'APAGAR_CONTA', contaId: 'cartao-2' });

    expect(contaSugerida(cartao, depois.contas)).toBe('cartao');
  });

  it('extrato sem identificação de conta não mexe em nada', () => {
    const anonimo = { ...cartao, contaExterna: undefined };
    expect(vincularConta(estadoInicial.contas, 'cartao', anonimo)).toBe(estadoInicial.contas);
  });

  it('confirmar de novo na mesma conta não troca o array — nada vai ao disco', () => {
    const vinculadas = vincularConta(estadoInicial.contas, 'cartao', cartao);
    expect(vincularConta(vinculadas, 'cartao', cartao)).toBe(vinculadas);
  });
});

describe('categoria aprendida', () => {
  it('o texto que a pessoa já categorizou volta com a mesma categoria', () => {
    const anterior: Transacao = {
      id: 'antiga',
      contaId: 'cartao',
      categoriaId: 'assinaturas',
      valorCentavos: -1990,
      ocorridoEm: '2026-06-17',
      descricao: 'Streaming',
      descricaoOriginal: 'Streamingbr',
      idExterno: 'fitid-antigo',
      origem: 'ofx',
      criadoEm: 1,
    };
    const e = { ...estadoInicial, transacoes: [anterior, ...estadoInicial.transacoes] };
    const previa = montarPrevia(cartao, 'cartao', {}, e);
    const linha = previa.linhas.find((l) => l.bruta.descricaoOriginal === 'Streamingbr')!;

    expect(linha).toMatchObject({ situacao: 'nova', categoriaId: 'assinaturas' });
  });

  it('texto sem histórico fica sem categoria, e o toast conta quantas', () => {
    const depois = sessao().importar(cartao);
    const semCategoria = novas(estadoInicial, depois).filter((t) => t.categoriaId === '');
    expect(semCategoria.length).toBeGreaterThan(0);
    expect(depois.toast!.sub).toContain(`${semCategoria.length} sem categoria`);
  });
});
