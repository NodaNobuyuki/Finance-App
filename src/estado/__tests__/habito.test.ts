import { inicioDaSemana, somarDias } from '../../dominio/datas';
import { desafios, metas, semana, semanaEstaFechada, totalGuardado } from '../derivados';
import { Acao, criarReducer, dependenciasDeTeste, Estado, estadoInicial } from '../store';

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
  const guardar = (metaId: string, digitos: string) =>
    aplicar(
      estadoInicial,
      { tipo: 'ABRIR_APORTE', metaId },
      { tipo: 'DEFINIR_DIGITOS', digitos },
      { tipo: 'CONFIRMAR_APORTE' },
    );

  it('registra o aporte como evento, em centavos, e limpa o rascunho', () => {
    const depois = guardar('reserva', '10000');
    expect(depois.aportes).toHaveLength(1);
    expect(depois.aportes[0]).toMatchObject({
      metaId: 'reserva',
      valorCentavos: 10000,
      ocorridoEm: estadoInicial.hoje,
      origem: 'manual',
    });
    expect(depois.folha).toBeNull();
    expect(depois.rascunho.digitos).toBe('');
  });

  it('move o guardado da meta, sem tocar nas outras', () => {
    const antes = metas(estadoInicial);
    const depois = metas(guardar('reserva', '10000'));
    const antesReserva = antes.find((m) => m.id === 'reserva')!;
    const depoisReserva = depois.find((m) => m.id === 'reserva')!;

    expect(depoisReserva.guardadoCentavos).toBe(antesReserva.guardadoCentavos + 10000);
    expect(depois.find((m) => m.id === 'chile')!.guardadoCentavos).toBe(
      antes.find((m) => m.id === 'chile')!.guardadoCentavos,
    );
    expect(totalGuardado(guardar('reserva', '10000'))).toBe(totalGuardado(estadoInicial) + 10000);
  });

  it('ignora meta inexistente em vez de criar aporte órfão', () => {
    const depois = guardar('meta-que-nao-existe', '10000');
    expect(depois.aportes).toHaveLength(0);
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
