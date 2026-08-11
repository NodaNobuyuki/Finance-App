import { somarDias } from '../../dominio/datas';
import { saldoDaConta, saldoTotal } from '../../dominio/saldo';
import { metas, totalGuardado } from '../derivados';
import {
  Acao,
  criarReducer,
  dependenciasDeTeste,
  Estado,
  estadoInicial,
  estadoVazio,
} from '../store';

/**
 * Criar, editar e apagar conta e meta com o app já rodando.
 *
 * Antes disto só o onboarding criava conta e meta, e categoria nem isso: quem
 * apagasse tudo, ou só quisesse uma segunda conta, ficava sem caminho nenhum.
 */

function aplicar(estado: Estado, ...acoes: Acao[]): Estado {
  return acoes.reduce(criarReducer(dependenciasDeTeste()), estado);
}

const criarConta = (estado: Estado, nome: string, digitos = '', tipo_?: 'cartao') =>
  aplicar(
    estado,
    { tipo: 'ABRIR_CONTA' },
    ...(tipo_ ? ([{ tipo: 'CADASTRO_CONTA_TIPO', tipo_ }] as Acao[]) : []),
    { tipo: 'CADASTRO_CONTA_CAMPO', campo: 'nome', valor: nome },
    { tipo: 'CADASTRO_CONTA_CAMPO', campo: 'digitos', valor: digitos },
    { tipo: 'SALVAR_CONTA' },
  );

const criarMeta = (estado: Estado, nome: string, digitos: string, prazo: string | null = null) =>
  aplicar(
    estado,
    { tipo: 'ABRIR_META' },
    { tipo: 'CADASTRO_META_CAMPO', campo: 'nome', valor: nome },
    { tipo: 'CADASTRO_META_CAMPO', campo: 'digitos', valor: digitos },
    { tipo: 'CADASTRO_META_PRAZO', prazo },
    { tipo: 'SALVAR_META' },
  );

describe('criar conta', () => {
  it('grava o saldo de abertura em centavos inteiros', () => {
    const depois = criarConta(estadoVazio, 'Nubank', '150000');
    const nova = depois.contas[0];

    expect(depois.contas).toHaveLength(1);
    expect(nova.nome).toBe('Nubank');
    expect(nova.saldoInicialCentavos).toBe(150000);
    expect(Number.isInteger(nova.saldoInicialCentavos)).toBe(true);
    expect(depois.folha).toBeNull();
  });

  it('cartão nasce com saldo negativo — o tipo diz o sinal', () => {
    // Digitar "menos" num teclado numérico é fricção sem ganho, e um cartão com
    // fatura em aberto lançado como positivo inflaria o patrimônio.
    const depois = criarConta(estadoVazio, 'Cartão', '62090', 'cartao');
    expect(depois.contas[0].saldoInicialCentavos).toBe(-62090);
  });

  it('a primeira conta vira o destino do próximo lançamento', () => {
    // Sem isto o primeiro gasto cairia numa conta que não existe.
    const depois = criarConta(estadoVazio, 'Nubank');
    expect(depois.rascunho.contaId).toBe(depois.contas[0].id);
  });

  it('a segunda conta não rouba o destino da primeira', () => {
    const uma = criarConta(estadoVazio, 'Nubank');
    const duas = criarConta(uma, 'Carteira');
    expect(duas.contas).toHaveLength(2);
    expect(duas.rascunho.contaId).toBe(uma.contas[0].id);
  });

  it('não cria conta sem nome', () => {
    const depois = aplicar(estadoVazio, { tipo: 'ABRIR_CONTA' }, { tipo: 'SALVAR_CONTA' });
    expect(depois.contas).toEqual([]);
  });

  it('a conta nova entra no saldo total pelo valor de abertura', () => {
    const antes = saldoTotal(estadoInicial.contas, estadoInicial.transacoes);
    const depois = criarConta(estadoInicial, 'Poupança 2', '100000');
    expect(saldoTotal(depois.contas, depois.transacoes)).toBe(antes + 100000);
  });
});

describe('editar conta', () => {
  it('abre com os dados atuais e salva por cima', () => {
    const aberta = aplicar(estadoInicial, { tipo: 'ABRIR_CONTA', contaId: 'carteira' });
    expect(aberta.cadastroConta.id).toBe('carteira');
    expect(aberta.cadastroConta.nome).toBe('Carteira');

    const salva = aplicar(
      aberta,
      { tipo: 'CADASTRO_CONTA_CAMPO', campo: 'nome', valor: 'Dinheiro vivo' },
      { tipo: 'SALVAR_CONTA' },
    );
    expect(salva.contas).toHaveLength(estadoInicial.contas.length);
    expect(salva.contas.find((c) => c.id === 'carteira')!.nome).toBe('Dinheiro vivo');
  });

  it('mudar a abertura move o saldo derivado, sem tocar nos lançamentos', () => {
    const antes = estadoInicial.contas.find((c) => c.id === 'carteira')!;
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_CONTA', contaId: 'carteira' },
      { tipo: 'CADASTRO_CONTA_CAMPO', campo: 'digitos', valor: '100000' },
      { tipo: 'SALVAR_CONTA' },
    );
    const nova = depois.contas.find((c) => c.id === 'carteira')!;

    expect(depois.transacoes).toBe(estadoInicial.transacoes);
    expect(saldoDaConta(nova, depois.transacoes)).toBe(
      saldoDaConta(antes, depois.transacoes) - antes.saldoInicialCentavos + 100000,
    );
  });

  it('cor escolhida a dedo sobrevive à edição', () => {
    const antes = estadoInicial.contas.find((c) => c.id === 'carteira')!;
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_CONTA', contaId: 'carteira' },
      { tipo: 'CADASTRO_CONTA_CAMPO', campo: 'nome', valor: 'Outro nome' },
      { tipo: 'SALVAR_CONTA' },
    );
    expect(depois.contas.find((c) => c.id === 'carteira')!.cor).toEqual(antes.cor);
  });

  it('trocar o tipo repinta a conta', () => {
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_CONTA', contaId: 'carteira' },
      { tipo: 'CADASTRO_CONTA_TIPO', tipo_: 'cartao' },
      { tipo: 'SALVAR_CONTA' },
    );
    const conta = depois.contas.find((c) => c.id === 'carteira')!;
    expect(conta.tipo).toBe('cartao');
    expect(conta.cor).not.toEqual(estadoInicial.contas.find((c) => c.id === 'carteira')!.cor);
  });
});

describe('apagar conta', () => {
  it('leva os lançamentos junto, para o total não mudar sem explicação', () => {
    // Lançamento órfão sairia do saldo de toda conta (a soma filtra por
    // `contaId`) e continuaria no Extrato: o total mudaria sozinho.
    const doCartao = estadoInicial.transacoes.filter((t) => t.contaId === 'cartao');
    expect(doCartao.length).toBeGreaterThan(0);

    const depois = aplicar(estadoInicial, { tipo: 'APAGAR_CONTA', contaId: 'cartao' });

    expect(depois.contas.some((c) => c.id === 'cartao')).toBe(false);
    expect(depois.transacoes.some((t) => t.contaId === 'cartao')).toBe(false);
    expect(depois.transacoes).toHaveLength(estadoInicial.transacoes.length - doCartao.length);
  });

  it('desfazer devolve conta e lançamentos', () => {
    const apagada = aplicar(estadoInicial, { tipo: 'APAGAR_CONTA', contaId: 'cartao' });
    expect(apagada.toast?.acao?.rotulo).toBe('Desfazer');

    const restaurada = aplicar(apagada, apagada.toast!.acao!.acao);
    expect(restaurada.contas).toHaveLength(estadoInicial.contas.length);
    expect(restaurada.transacoes).toHaveLength(estadoInicial.transacoes.length);
    expect(saldoTotal(restaurada.contas, restaurada.transacoes)).toBe(
      saldoTotal(estadoInicial.contas, estadoInicial.transacoes),
    );
  });

  it('a última conta não é apagável — o app ficaria sem destino de lançamento', () => {
    const uma = criarConta(estadoVazio, 'Nubank');
    const tentativa = aplicar(uma, { tipo: 'APAGAR_CONTA', contaId: uma.contas[0].id });

    expect(tentativa.contas).toHaveLength(1);
    expect(tentativa.toast?.texto).toBe('Esta é sua única conta');
  });

  it('apagar a conta do rascunho reaponta para uma que existe', () => {
    const depois = aplicar(
      { ...estadoInicial, rascunho: { ...estadoInicial.rascunho, contaId: 'cartao' } },
      { tipo: 'APAGAR_CONTA', contaId: 'cartao' },
    );
    expect(depois.contas.some((c) => c.id === depois.rascunho.contaId)).toBe(true);
  });

  it('conta inexistente não vira toast nem mexe em nada', () => {
    expect(aplicar(estadoInicial, { tipo: 'APAGAR_CONTA', contaId: 'nao-existe' })).toBe(
      estadoInicial,
    );
  });
});

describe('criar meta', () => {
  it('nasce zerada, com prazo como data', () => {
    const prazo = somarDias(estadoVazio.hoje, 365);
    const depois = criarMeta(estadoVazio, 'Reserva', '500000', prazo);
    const nova = depois.metas[0];

    expect(nova.nome).toBe('Reserva');
    expect(nova.alvoCentavos).toBe(500000);
    expect(nova.guardadoInicialCentavos).toBe(0);
    expect(nova.prazo).toBe(prazo);
    expect(depois.folha).toBeNull();
  });

  it('meta sem prazo é válida', () => {
    expect(criarMeta(estadoVazio, 'Reserva', '500000').metas[0].prazo).toBeNull();
  });

  it('não cria meta sem alvo — sem alvo não há progresso para mostrar', () => {
    expect(criarMeta(estadoVazio, 'Reserva', '').metas).toEqual([]);
    expect(criarMeta(estadoVazio, '', '500000').metas).toEqual([]);
  });

  it('o rótulo do prazo sai derivado, não gravado', () => {
    const depois = criarMeta(estadoVazio, 'Chile', '800000', somarDias(estadoVazio.hoje, 132));
    expect(metas(depois)[0].prazoLabel).toBe('faltam 132 dias · 15 dez 2026');

    // Uma semana depois, o mesmo dado diz outra coisa — que é o ponto.
    const semanaQueVem = { ...depois, hoje: somarDias(depois.hoje, 7) };
    expect(metas(semanaQueVem)[0].prazoLabel).toBe('faltam 125 dias · 15 dez 2026');
  });
});

describe('editar meta', () => {
  it('muda alvo e prazo sem mexer no que já foi guardado', () => {
    const antes = metas(estadoInicial).find((m) => m.id === 'reserva')!;
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_META', metaId: 'reserva' },
      { tipo: 'CADASTRO_META_CAMPO', campo: 'digitos', valor: '2000000' },
      { tipo: 'CADASTRO_META_PRAZO', prazo: null },
      { tipo: 'SALVAR_META' },
    );
    const editada = metas(depois).find((m) => m.id === 'reserva')!;

    expect(editada.alvoCentavos).toBe(2000000);
    expect(editada.prazo).toBeNull();
    expect(editada.guardadoCentavos).toBe(antes.guardadoCentavos);
  });

  it('editar não cria meta nova', () => {
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_META', metaId: 'reserva' },
      { tipo: 'CADASTRO_META_CAMPO', campo: 'nome', valor: 'Emergência' },
      { tipo: 'SALVAR_META' },
    );
    expect(depois.metas).toHaveLength(estadoInicial.metas.length);
    expect(depois.metas.find((m) => m.id === 'reserva')!.nome).toBe('Emergência');
  });
});

describe('apagar meta', () => {
  it('tira a meta do total guardado', () => {
    const antes = totalGuardado(estadoInicial);
    const reserva = metas(estadoInicial).find((m) => m.id === 'reserva')!;
    const depois = aplicar(estadoInicial, { tipo: 'APAGAR_META', metaId: 'reserva' });

    expect(depois.metas.some((m) => m.id === 'reserva')).toBe(false);
    expect(totalGuardado(depois)).toBe(antes - reserva.guardadoCentavos);
  });

  it('os aportes ficam, e desfazer devolve o guardado exato', () => {
    // `guardadoDaMeta` filtra por `metaId`, então aporte de meta apagada não
    // entra em total nenhum — e continua lá para o desfazer reconstruir tudo.
    const comAporte = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_APORTE', metaId: 'reserva' },
      { tipo: 'DEFINIR_DIGITOS', digitos: '30000' },
      { tipo: 'CONFIRMAR_APORTE' },
    );
    const antes = totalGuardado(comAporte);

    const apagada = aplicar(comAporte, { tipo: 'APAGAR_META', metaId: 'reserva' });
    // As transações ficam: o dinheiro guardado é real e continua na conta onde
    // está. Some só o rótulo que dizia para qual meta ele era.
    expect(apagada.transacoes).toHaveLength(comAporte.transacoes.length);
    expect(saldoTotal(apagada.contas, apagada.transacoes)).toBe(
      saldoTotal(comAporte.contas, comAporte.transacoes),
    );

    const restaurada = aplicar(apagada, apagada.toast!.acao!.acao);
    expect(totalGuardado(restaurada)).toBe(antes);
  });

  it('meta inexistente não mexe em nada', () => {
    expect(aplicar(estadoInicial, { tipo: 'APAGAR_META', metaId: 'nao-existe' })).toBe(
      estadoInicial,
    );
  });
});
