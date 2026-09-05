import { inicioDaSemana, somarDias } from '../../dominio/datas';
import { guardadoDaMeta } from '../../dominio/metas';
import { saldoDaConta, saldoTotal } from '../../dominio/saldo';
import {
  desafios,
  historicoDeSemanas,
  metas,
  orcamento,
  resumoDoMes,
  semana,
  semanaEstaFechada,
  semanasEmDia,
  totalGuardado,
} from '../derivados';
import {
  Acao,
  criarReducer,
  dependenciasDeTeste,
  Estado,
  estadoInicial,
  estadoVazio,
} from '../store';

/**
 * O ciclo do hábito é o produto. Estes testes travam o comportamento que o
 * usuário sente: registrar avança a semana, desfazer volta atrás, e colocar
 * em dia fecha os dias abertos sem perder nada.
 */

function aplicar(estado: Estado, ...acoes: Acao[]): Estado {
  return acoes.reduce(criarReducer(dependenciasDeTeste()), estado);
}

describe('semana', () => {
  it('parte da segunda-feira e marca os dias em aberto até hoje', () => {
    const s = semana(estadoInicial);
    // Seed vai até 2026-08-03 (segunda); hoje é 2026-08-05 (quarta).
    expect(s.inicio).toBe('2026-08-03');
    expect(s.pendentes).toEqual(['2026-08-04', '2026-08-05']);
    expect(s.registros).toBe(1);
    expect(s.emDia).toBe(false);
  });

  it('não conta dias futuros como pendentes', () => {
    const s = semana(estadoInicial);
    expect(s.pendentes.every((d) => d <= estadoInicial.hoje)).toBe(true);
    expect(s.dias).toHaveLength(7);
  });
});

describe('registro rápido', () => {
  it('cria a transação em centavos, com origem rastreável', () => {
    const depois = aplicar(estadoInicial, {
      tipo: 'REGISTRO_RAPIDO',
      categoriaId: 'mercado',
      valorCentavos: 2000,
    });
    const nova = depois.transacoes[0];
    expect(nova.valorCentavos).toBe(-2000);
    expect(Number.isInteger(nova.valorCentavos)).toBe(true);
    expect(nova.origem).toBe('manual');
    expect(nova.ocorridoEm).toBe(estadoInicial.hoje);
  });

  it('avança a contagem da semana e oferece desfazer', () => {
    const depois = aplicar(estadoInicial, {
      tipo: 'REGISTRO_RAPIDO',
      categoriaId: 'mercado',
      valorCentavos: 2000,
    });
    expect(semana(depois).registros).toBe(semana(estadoInicial).registros + 1);
    expect(depois.toast?.acao?.rotulo).toBe('Desfazer');
  });

  it('ignora valor zero', () => {
    const depois = aplicar(estadoInicial, {
      tipo: 'REGISTRO_RAPIDO',
      categoriaId: 'mercado',
      valorCentavos: 0,
    });
    expect(depois.transacoes).toHaveLength(estadoInicial.transacoes.length);
  });
});

describe('desfazer', () => {
  it('remove exatamente o que foi lançado', () => {
    const registrado = aplicar(estadoInicial, {
      tipo: 'REGISTRO_RAPIDO',
      categoriaId: 'mercado',
      valorCentavos: 2000,
    });
    const desfeito = aplicar(registrado, registrado.toast!.acao!.acao);
    expect(desfeito.transacoes).toHaveLength(estadoInicial.transacoes.length);
    expect(semana(desfeito).registros).toBe(semana(estadoInicial).registros);
  });
});

describe('lançamento em lote', () => {
  const pendentes = semana(estadoInicial).pendentes;

  it('fecha os dias abertos e deixa a semana em dia', () => {
    const preenchido = aplicar(
      estadoInicial,
      { tipo: 'LOTE_VALOR', dia: pendentes[0], texto: '42,50' },
      { tipo: 'LOTE_SEM_GASTO', dia: pendentes[1] },
      { tipo: 'SALVAR_LOTE', pendentes },
    );

    expect(semana(preenchido).pendentes).toHaveLength(0);
    expect(semana(preenchido).emDia).toBe(true);
    // "Não gastei" registra o dia sem criar transação.
    expect(preenchido.transacoes).toHaveLength(estadoInicial.transacoes.length + 1);
    expect(preenchido.transacoes[0].valorCentavos).toBe(-4250);
  });

  it('não salva com dia incompleto', () => {
    const parcial = aplicar(
      estadoInicial,
      { tipo: 'LOTE_VALOR', dia: pendentes[0], texto: '42,50' },
      { tipo: 'SALVAR_LOTE', pendentes },
    );
    expect(parcial.transacoes).toHaveLength(estadoInicial.transacoes.length);
  });

  it('desfazer devolve os dias ao estado em aberto', () => {
    const salvo = aplicar(
      estadoInicial,
      { tipo: 'LOTE_VALOR', dia: pendentes[0], texto: '42,50' },
      { tipo: 'LOTE_SEM_GASTO', dia: pendentes[1] },
      { tipo: 'SALVAR_LOTE', pendentes },
    );
    const desfeito = aplicar(salvo, salvo.toast!.acao!.acao);
    expect(semana(desfeito).pendentes).toEqual(pendentes);
    expect(desfeito.transacoes).toHaveLength(estadoInicial.transacoes.length);
  });
});

describe('fechamento da semana', () => {
  const fechar = (estado: Estado) =>
    aplicar(
      estado,
      { tipo: 'FECHAR_INICIAR' },
      { tipo: 'FECHAR_PASSO', passo: 3 },
      { tipo: 'FECHAR_INTENCAO', id: 'delivery', nome: 'Menos delivery' },
      { tipo: 'FECHAR_CONCLUIR' },
    );

  it('percorre os 3 passos e volta para a home fechada', () => {
    const fechado = fechar(estadoInicial);
    expect(semanaEstaFechada(fechado)).toBe(true);
    expect(fechado.tela).toBe('home');
    expect(fechado.fechando).toBe(false);
    expect(fechado.toast?.sub).toContain('menos delivery');
  });

  it('guarda QUAL semana foi fechada, não um sim/não', () => {
    expect(fechar(estadoInicial).semanaFechada).toBe(inicioDaSemana(estadoInicial.hoje));
  });

  it('virou a semana, o ritual reabre sozinho', () => {
    const fechado = fechar(estadoInicial);
    // Segunda-feira seguinte: o fechamento gravado é de outra semana.
    const proximaSemana = somarDias(inicioDaSemana(estadoInicial.hoje), 7);
    const depois = aplicar(fechado, { tipo: 'DIA_MUDOU', dia: proximaSemana });

    expect(semanaEstaFechada(depois)).toBe(false);
    // O registro do fechamento anterior continua lá — não foi apagado, só deixou
    // de valer para a semana corrente.
    expect(depois.semanaFechada).toBe(inicioDaSemana(estadoInicial.hoje));
  });

  it('ainda na mesma semana, continua fechada no dia seguinte', () => {
    const fechado = fechar(estadoInicial);
    const amanha = somarDias(estadoInicial.hoje, 1);
    const depois = aplicar(fechado, { tipo: 'DIA_MUDOU', dia: amanha });
    expect(semanaEstaFechada(depois)).toBe(inicioDaSemana(amanha) === fechado.semanaFechada);
  });
});

describe('constância', () => {
  /** Marca `dias` registros na semana que começa `semanas` atrás. */
  const comRegistros = (estado: Estado, semanas: number, dias: number): Estado => {
    const inicio = somarDias(inicioDaSemana(estado.hoje), -7 * semanas);
    return {
      ...estado,
      diasSemGasto: [
        ...estado.diasSemGasto,
        ...Array.from({ length: dias }, (_, i) => somarDias(inicio, i)),
      ],
    };
  };

  const limpo = (): Estado => ({ ...estadoVazio, diasSemGasto: [], transacoes: [] });

  it('a trilha vem dos dias registrados, não de um contador gravado', () => {
    // Esta é a regressão que motivou a mudança: `historicoSemanas` era um array
    // que nada escrevia, então a trilha de quem usava o app nunca passava da
    // semana corrente por mais semanas que ele fechasse.
    const e = comRegistros(comRegistros(limpo(), 1, 4), 2, 3);
    const trilha = historicoDeSemanas(e);

    expect(trilha).toHaveLength(3); // 2 semanas atrás, 1 atrás e a corrente
    expect(trilha.map((w) => w.registros)).toEqual([3, 4, 0]);
    expect(trilha.map((w) => w.atingiu)).toEqual([false, true, false]);
  });

  it('conta as semanas seguidas que bateram a meta', () => {
    const e = comRegistros(comRegistros(comRegistros(limpo(), 1, 4), 2, 5), 3, 2);
    // 3 semanas atrás ficou em 2 de 4 e quebra a sequência.
    expect(semanasEmDia(e)).toBe(2);
  });

  it('a semana corrente em andamento não zera o streak', () => {
    // Segunda-feira de manhã, nada registrado ainda: a semana não falhou, só
    // não terminou. Contá-la como falha zeraria o número toda semana.
    const e = comRegistros(limpo(), 1, 4);
    expect(semana(e).registros).toBe(0);
    expect(semanasEmDia(e)).toBe(1);
  });

  it('a semana corrente entra assim que cumpre a meta', () => {
    // Meta 3 porque hoje é quarta: a semana corrente só tem 3 dias vividos, e
    // dia futuro não conta como registro nem para a trilha nem para o streak.
    const base: Estado = { ...comRegistros(limpo(), 1, 3), metaSemanal: 3 };
    expect(semanasEmDia(base)).toBe(1);

    const cumprida = comRegistros(base, 0, 4);
    expect(semana(cumprida).registros).toBe(3);
    expect(semanasEmDia(cumprida)).toBe(2);
  });

  it('lançamento com data retroativa corrige a semana passada', () => {
    // É o caso da importação de OFX. Um contador gravado no fechamento ficaria
    // velho; derivado, o número se acerta sozinho.
    const e = comRegistros(limpo(), 1, 3);
    expect(semanasEmDia(e)).toBe(0);
    expect(semanasEmDia(comRegistros(e, 1, 4))).toBe(1);
  });

  it('a trilha não mostra semanas anteriores ao primeiro registro', () => {
    const e = comRegistros(limpo(), 1, 4);
    expect(historicoDeSemanas(e)).toHaveLength(2);
  });

  it('a trilha para de crescer no limite da tela', () => {
    let e = limpo();
    for (let s = 1; s <= 12; s++) e = comRegistros(e, s, 4);
    expect(historicoDeSemanas(e)).toHaveLength(6);
    // O streak não é limitado pela trilha: aquilo é o que cabe na tela, isto é
    // o que a pessoa fez.
    expect(semanasEmDia(e)).toBe(12);
  });
});

describe('virada do dia', () => {
  it('move `hoje` e nada mais', () => {
    const amanha = somarDias(estadoInicial.hoje, 1);
    const depois = aplicar(estadoInicial, { tipo: 'DIA_MUDOU', dia: amanha });
    expect(depois.hoje).toBe(amanha);
    expect(depois.transacoes).toBe(estadoInicial.transacoes);
  });

  it('mesmo dia não cria estado novo', () => {
    const depois = aplicar(estadoInicial, { tipo: 'DIA_MUDOU', dia: estadoInicial.hoje });
    expect(depois).toBe(estadoInicial);
  });

  it('o dia novo entra na conta da semana', () => {
    const amanha = somarDias(estadoInicial.hoje, 1);
    const depois = aplicar(estadoInicial, { tipo: 'DIA_MUDOU', dia: amanha });
    expect(semana(depois).pendentes).toContain(amanha);
  });
});

describe('aporte na meta', () => {
  /**
   * Guardar dinheiro é uma TRANSFERÊNCIA, não um contador que sobe.
   *
   * Enquanto o aporte era entidade própria, guardar R$ 500 não mexia em saldo
   * nenhum: o app prometia "transforme o gasto em aporte" e o dinheiro
   * continuava inteiro na conta. Estes testes travam as duas pontas.
   */
  const guardar = (metaId: string, digitos: string, contaOrigemId = 'corrente') =>
    aplicar(
      { ...estadoInicial, rascunho: { ...estadoInicial.rascunho, contaId: contaOrigemId } },
      { tipo: 'ABRIR_MOVIMENTO_META', metaId },
      { tipo: 'DEFINIR_DIGITOS', digitos },
      { tipo: 'CONFIRMAR_MOVIMENTO_META' },
    );

  const novas = (depois: Estado) =>
    depois.transacoes.filter((t) => !estadoInicial.transacoes.some((x) => x.id === t.id));

  it('cria o par de transações, ligado pelo mesmo id de transferência', () => {
    const depois = guardar('reserva', '10000');
    const par = novas(depois);

    expect(par).toHaveLength(2);
    expect(new Set(par.map((t) => t.transferenciaId)).size).toBe(1);
    expect(par.every((t) => t.transferenciaId !== undefined)).toBe(true);
    expect(depois.folha).toBeNull();
    expect(depois.rascunho.digitos).toBe('');
  });

  it('sai da conta de origem e entra na conta da meta', () => {
    const depois = guardar('reserva', '10000');
    const [saida, entrada] = novas(depois).sort((a, b) => a.valorCentavos - b.valorCentavos);

    expect(saida).toMatchObject({ contaId: 'corrente', valorCentavos: -10000 });
    expect(entrada).toMatchObject({ contaId: 'poupanca', valorCentavos: 10000 });
    // Só a entrada carrega o `metaId`: se a saída carregasse, ela entraria no
    // guardado com sinal negativo e o total ficaria zerado.
    expect(saida.metaId).toBeUndefined();
    expect(entrada.metaId).toBe('reserva');
  });

  it('o saldo da conta de origem cai de verdade', () => {
    // É a regressão que motivou tudo isto.
    const corrente = estadoInicial.contas.find((c) => c.id === 'corrente')!;
    const antes = saldoDaConta(corrente, estadoInicial.transacoes);
    const depois = guardar('reserva', '10000');

    expect(saldoDaConta(corrente, depois.transacoes)).toBe(antes - 10000);
  });

  it('o patrimônio total não muda — o dinheiro só trocou de lugar', () => {
    const depois = guardar('reserva', '10000');
    expect(saldoTotal(depois.contas, depois.transacoes)).toBe(
      saldoTotal(estadoInicial.contas, estadoInicial.transacoes),
    );
  });

  it('guardar não vira despesa do mês', () => {
    // Sem isto o orçamento estouraria e o resumo do mês mostraria R$ 100 de
    // gasto que ninguém gastou.
    const depois = guardar('reserva', '10000');
    expect(resumoDoMes(depois).despesas).toBe(resumoDoMes(estadoInicial).despesas);
    expect(resumoDoMes(depois).receitas).toBe(resumoDoMes(estadoInicial).receitas);
    expect(orcamento(depois).gasto).toBe(orcamento(estadoInicial).gasto);
  });

  it('move o guardado da meta, sem tocar nas outras', () => {
    const antes = metas(estadoInicial);
    const depois = metas(guardar('reserva', '10000'));

    expect(depois.find((m) => m.id === 'reserva')!.guardadoCentavos).toBe(
      antes.find((m) => m.id === 'reserva')!.guardadoCentavos + 10000,
    );
    expect(depois.find((m) => m.id === 'chile')!.guardadoCentavos).toBe(
      antes.find((m) => m.id === 'chile')!.guardadoCentavos,
    );
    expect(totalGuardado(guardar('reserva', '10000'))).toBe(totalGuardado(estadoInicial) + 10000);
  });

  it('guardar na mesma conta em que o dinheiro já está não mexe no saldo', () => {
    // A meta guarda na poupança; guardar A PARTIR da poupança é só marcar o
    // dinheiro como reservado. Mostrar o saldo caindo seria inventar uma
    // movimentação que não houve.
    const poupanca = estadoInicial.contas.find((c) => c.id === 'poupanca')!;
    const antes = saldoDaConta(poupanca, estadoInicial.transacoes);
    const depois = guardar('reserva', '10000', 'poupanca');

    expect(saldoDaConta(poupanca, depois.transacoes)).toBe(antes);
    expect(totalGuardado(depois)).toBe(totalGuardado(estadoInicial) + 10000);
  });

  it('desfazer remove as duas pontas juntas', () => {
    const depois = guardar('reserva', '10000');
    expect(depois.toast?.acao?.rotulo).toBe('Desfazer');

    const desfeito = aplicar(depois, depois.toast!.acao!.acao);
    expect(desfeito.transacoes).toHaveLength(estadoInicial.transacoes.length);
    expect(totalGuardado(desfeito)).toBe(totalGuardado(estadoInicial));
    expect(saldoTotal(desfeito.contas, desfeito.transacoes)).toBe(
      saldoTotal(estadoInicial.contas, estadoInicial.transacoes),
    );
  });

  it('ignora meta inexistente em vez de criar transferência órfã', () => {
    const depois = guardar('meta-que-nao-existe', '10000');
    expect(depois.transacoes).toHaveLength(estadoInicial.transacoes.length);
  });
});

describe('retirar da meta', () => {
  /**
   * O caminho de volta. Sem ele, quem guardasse por engano ficava preso assim
   * que o toast de desfazer sumisse — dinheiro que entra e nunca sai.
   *
   * É a mesma transferência invertida: a conta da meta vira a ORIGEM, e é ela
   * que leva o `metaId`, agora com valor negativo.
   */
  const guardar = (digitos: string) =>
    aplicar(
      { ...estadoInicial, rascunho: { ...estadoInicial.rascunho, contaId: 'corrente' } },
      { tipo: 'ABRIR_MOVIMENTO_META', metaId: 'reserva' },
      { tipo: 'DEFINIR_DIGITOS', digitos },
      { tipo: 'CONFIRMAR_MOVIMENTO_META' },
    );

  const retirar = (estado: Estado, digitos: string, paraContaId = 'corrente') =>
    aplicar(
      estado,
      { tipo: 'ABRIR_MOVIMENTO_META', metaId: 'reserva', retirar: true },
      { tipo: 'RASCUNHO_CONTA', contaId: paraContaId },
      { tipo: 'DEFINIR_DIGITOS', digitos },
      { tipo: 'CONFIRMAR_MOVIMENTO_META' },
    );

  it('a saída marca a meta e derruba o guardado', () => {
    const antes = totalGuardado(estadoInicial);
    const depois = retirar(estadoInicial, '10000');

    expect(totalGuardado(depois)).toBe(antes - 10000);

    const par = depois.transacoes.filter(
      (t) => !estadoInicial.transacoes.some((x) => x.id === t.id),
    );
    const daMeta = par.find((t) => t.metaId === 'reserva')!;
    expect(daMeta.valorCentavos).toBe(-10000);
    expect(daMeta.contaId).toBe('poupanca');
  });

  it('o dinheiro volta para a conta escolhida', () => {
    const corrente = estadoInicial.contas.find((c) => c.id === 'corrente')!;
    const depois = retirar(estadoInicial, '10000');

    expect(saldoDaConta(corrente, depois.transacoes)).toBe(
      saldoDaConta(corrente, estadoInicial.transacoes) + 10000,
    );
  });

  it('o patrimônio não muda, e retirar não vira receita', () => {
    const depois = retirar(estadoInicial, '10000');
    expect(saldoTotal(depois.contas, depois.transacoes)).toBe(
      saldoTotal(estadoInicial.contas, estadoInicial.transacoes),
    );
    expect(resumoDoMes(depois).receitas).toBe(resumoDoMes(estadoInicial).receitas);
  });

  it('guardar e retirar o mesmo valor volta tudo ao ponto de partida', () => {
    const ida = guardar('10000');
    const volta = retirar(ida, '10000');

    expect(totalGuardado(volta)).toBe(totalGuardado(estadoInicial));
    expect(saldoTotal(volta.contas, volta.transacoes)).toBe(
      saldoTotal(estadoInicial.contas, estadoInicial.transacoes),
    );
    // As quatro linhas continuam no Extrato: o dinheiro andou de verdade, e o
    // histórico não some porque o saldo voltou.
    expect(volta.transacoes).toHaveLength(estadoInicial.transacoes.length + 4);
  });

  it('não deixa retirar mais do que está guardado', () => {
    // O guardado ficaria negativo e a meta passaria a dever a si mesma.
    const reserva = metas(estadoInicial).find((m) => m.id === 'reserva')!;
    const demais = retirar(estadoInicial, String(reserva.guardadoCentavos + 100));

    expect(totalGuardado(demais)).toBe(totalGuardado(estadoInicial));
    expect(demais.transacoes).toHaveLength(estadoInicial.transacoes.length);
    expect(demais.toast?.texto).toContain('guardados');
  });

  it('retirar exatamente tudo é permitido', () => {
    const reserva = metas(estadoInicial).find((m) => m.id === 'reserva')!;
    const depois = retirar(estadoInicial, String(reserva.guardadoCentavos));

    expect(metas(depois).find((m) => m.id === 'reserva')!.guardadoCentavos).toBe(0);
  });

  it('desfazer devolve o guardado', () => {
    const depois = retirar(estadoInicial, '10000');
    const desfeito = aplicar(depois, depois.toast!.acao!.acao);
    expect(totalGuardado(desfeito)).toBe(totalGuardado(estadoInicial));
  });
});

describe('transferência entre contas', () => {
  const transferir = (de: string, para: string, digitos: string) =>
    aplicar(
      estadoInicial,
      { tipo: 'ABRIR_TRANSFERENCIA' },
      { tipo: 'RASCUNHO_CONTA', contaId: de },
      { tipo: 'TRANSFERENCIA_DESTINO', contaId: para },
      { tipo: 'DEFINIR_DIGITOS', digitos },
      { tipo: 'CONFIRMAR_TRANSFERENCIA' },
    );

  it('tira de uma conta e põe na outra', () => {
    // Pagar a fatura do cartão é exatamente isto.
    const corrente = estadoInicial.contas.find((c) => c.id === 'corrente')!;
    const cartao = estadoInicial.contas.find((c) => c.id === 'cartao')!;
    const depois = transferir('corrente', 'cartao', '50000');

    expect(saldoDaConta(corrente, depois.transacoes)).toBe(
      saldoDaConta(corrente, estadoInicial.transacoes) - 50000,
    );
    expect(saldoDaConta(cartao, depois.transacoes)).toBe(
      saldoDaConta(cartao, estadoInicial.transacoes) + 50000,
    );
  });

  it('não é gasto nem ganho, e o patrimônio fica igual', () => {
    const depois = transferir('corrente', 'poupanca', '50000');

    expect(saldoTotal(depois.contas, depois.transacoes)).toBe(
      saldoTotal(estadoInicial.contas, estadoInicial.transacoes),
    );
    expect(resumoDoMes(depois).despesas).toBe(resumoDoMes(estadoInicial).despesas);
    expect(resumoDoMes(depois).receitas).toBe(resumoDoMes(estadoInicial).receitas);
    expect(orcamento(depois).gasto).toBe(orcamento(estadoInicial).gasto);
  });

  it('não marca meta nenhuma — é dinheiro sem dono definido', () => {
    const depois = transferir('corrente', 'poupanca', '50000');
    const par = depois.transacoes.filter(
      (t) => !estadoInicial.transacoes.some((x) => x.id === t.id),
    );

    expect(par).toHaveLength(2);
    expect(par.every((t) => t.metaId === undefined)).toBe(true);
    expect(totalGuardado(depois)).toBe(totalGuardado(estadoInicial));
  });

  it('recusa origem e destino iguais', () => {
    const depois = transferir('corrente', 'corrente', '50000');
    expect(depois.transacoes).toHaveLength(estadoInicial.transacoes.length);
  });

  it('abre já com duas contas diferentes escolhidas', () => {
    const aberta = aplicar(estadoInicial, { tipo: 'ABRIR_TRANSFERENCIA' });
    expect(aberta.transferenciaDestinoId).not.toBe(aberta.rascunho.contaId);
    expect(aberta.contas.some((c) => c.id === aberta.transferenciaDestinoId)).toBe(true);
  });

  it('desfazer remove as duas pontas', () => {
    const depois = transferir('corrente', 'poupanca', '50000');
    const desfeito = aplicar(depois, depois.toast!.acao!.acao);
    expect(desfeito.transacoes).toHaveLength(estadoInicial.transacoes.length);
  });
});

describe('simulador guarda de verdade', () => {
  const simular = (estado: Estado, ...acoes: Acao[]) =>
    aplicar(
      { ...estado, rascunho: { ...estado.rascunho, contaId: 'corrente' } },
      { tipo: 'SIM_DEFINIR', digitos: '5000' },
      ...acoes,
      { tipo: 'SIM_GUARDAR' },
    );

  it('o fecho do loop também move dinheiro', () => {
    const depois = simular(estadoInicial, { tipo: 'SIM_META', metaId: 'chile' });
    const corrente = estadoInicial.contas.find((c) => c.id === 'corrente')!;

    expect(saldoDaConta(corrente, depois.transacoes)).toBe(
      saldoDaConta(corrente, estadoInicial.transacoes) - 5000,
    );
    expect(totalGuardado(depois)).toBe(totalGuardado(estadoInicial) + 5000);
    expect(depois.tela).toBe('metas');
  });

  it('guarda na meta escolhida, não numa fixa', () => {
    const depois = simular(estadoInicial, { tipo: 'SIM_META', metaId: 'note' });
    const note = depois.metas.find((m) => m.id === 'note')!;

    expect(guardadoDaMeta(note, depois.transacoes)).toBe(
      guardadoDaMeta(note, estadoInicial.transacoes) + 5000,
    );
  });

  it('sem escolha, a primeira meta é o destino', () => {
    // `simMetaId` nasce `null`: quem só digita um valor e confirma tem de ver
    // dinheiro guardado, não um botão que não faz nada.
    const depois = simular(estadoInicial);
    const primeira = depois.metas[0];

    expect(depois.simMetaId).toBeNull();
    expect(guardadoDaMeta(primeira, depois.transacoes)).toBe(
      guardadoDaMeta(primeira, estadoInicial.transacoes) + 5000,
    );
  });

  it('escolha pendurada em meta apagada cai na primeira, sem sumir com o dinheiro', () => {
    const escolhida = aplicar(estadoInicial, { tipo: 'SIM_META', metaId: 'note' });
    const semNote = aplicar(escolhida, { tipo: 'APAGAR_META', metaId: 'note' });
    const depois = simular(semNote);

    expect(totalGuardado(depois)).toBe(totalGuardado(semNote) + 5000);
  });

  it('sem meta nenhuma, avisa em vez de sair calado', () => {
    // Era aqui que o loop morria: `return e` silencioso, e o botão principal
    // da tela que vende o app não fazia nada nem explicava por quê.
    const depois = simular({ ...estadoVazio, contas: estadoInicial.contas });

    expect(depois.transacoes).toEqual([]);
    expect(depois.toast?.texto).toBe('Nenhuma meta para guardar');
  });
});

describe('desafios', () => {
  it('entrar em um desafio o move de disponível para ativo', () => {
    const antes = desafios(estadoInicial);
    expect(antes.disponiveis.some((d) => d.id === 'cafe')).toBe(true);

    const depois = desafios(
      aplicar(estadoInicial, { tipo: 'ACEITAR_DESAFIO', desafioId: 'cafe', nome: '5 dias' }),
    );
    expect(depois.ativos.some((d) => d.id === 'cafe')).toBe(true);
    expect(depois.disponiveis.some((d) => d.id === 'cafe')).toBe(false);
  });

  it('marcar o dia avança só o desafio tocado, sem passar do alvo', () => {
    const marcar = { tipo: 'AVANCAR_DESAFIO', desafioId: 'assin', automatico: false, rotulo: 'x' };
    // 'assin' começa em 1 de 3: cinco toques não podem levar além de 3.
    const depois = aplicar(estadoInicial, ...(Array(5).fill(marcar) as Acao[]));
    const assin = desafios(depois).ativos.find((d) => d.id === 'assin')!;
    expect(assin.atual).toBe(assin.alvo);
    expect(assin.completo).toBe(true);
  });
});
