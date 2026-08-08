import { semana } from '../derivados';
import { Acao, Estado, estadoInicial, reducer } from '../store';

/**
 * O ciclo do hábito é o produto. Estes testes travam o comportamento que o
 * usuário sente: registrar avança a semana, desfazer volta atrás, e colocar
 * em dia fecha os dias abertos sem perder nada.
 */

function aplicar(estado: Estado, ...acoes: Acao[]): Estado {
  return acoes.reduce(reducer, estado);
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
  it('percorre os 3 passos e volta para a home fechada', () => {
    const fechado = aplicar(
      estadoInicial,
      { tipo: 'FECHAR_INICIAR' },
      { tipo: 'FECHAR_PASSO', passo: 3 },
      { tipo: 'FECHAR_INTENCAO', id: 'delivery', nome: 'Menos delivery' },
      { tipo: 'FECHAR_CONCLUIR' },
    );
    expect(fechado.semanaFechada).toBe(true);
    expect(fechado.tela).toBe('home');
    expect(fechado.fechando).toBe(false);
    expect(fechado.toast?.sub).toContain('menos delivery');
  });
});

describe('aporte na meta', () => {
  it('soma em centavos e limpa o rascunho', () => {
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_APORTE', metaId: 'reserva' },
      { tipo: 'DEFINIR_DIGITOS', digitos: '10000' },
      { tipo: 'CONFIRMAR_APORTE' },
    );
    expect(depois.aportes.reserva).toBe(10000);
    expect(depois.folha).toBeNull();
    expect(depois.rascunho.digitos).toBe('');
  });
});
