/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATEGORIA_TRANSFERENCIA } from '../../dominio/categorias';
import { saldoDaConta, saldoTotal, totalEntradas } from '../../dominio/saldo';
import { Transacao } from '../../dominio/tipos';
import { Acao, criarReducer, dependenciasDeTeste, Estado, estadoInicial } from '../../estado/store';
import { adapterOFX } from '../adapters/ofx';
import { contaSugerida, montarPrevia } from '../previa';
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
