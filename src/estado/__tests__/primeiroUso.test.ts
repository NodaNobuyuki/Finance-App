import { definicoesDesafios, progressoDe } from '../../dominio/desafios';
import { saldoDaConta } from '../../dominio/saldo';
import { desafios, historicoDeSemanas, metas, semana, semanasEmDia } from '../derivados';
import {
  Acao,
  criarEstadoDemo,
  criarReducer,
  dependenciasDeTeste,
  Estado,
  estadoVazio,
} from '../store';

/**
 * Primeiro uso.
 *
 * A demo sempre existiu, então nada disto tinha sido exercitado: o app nunca
 * abriu sem dado nenhum. É onde moram os números que mentem para quem acabou
 * de instalar.
 */

function aplicar(estado: Estado, ...acoes: Acao[]): Estado {
  return acoes.reduce(criarReducer(dependenciasDeTeste()), estado);
}

describe('estado vazio', () => {
  it('não tem nada do usuário dentro', () => {
    expect(estadoVazio.contas).toEqual([]);
    expect(estadoVazio.transacoes).toEqual([]);
    expect(estadoVazio.metas).toEqual([]);
    expect(estadoVazio.progressoDesafios).toEqual([]);
    expect(estadoVazio.diasSemGasto).toEqual([]);
    expect(estadoVazio.perfil.nome).toBe('');
  });

  it('não inventa constância para quem acabou de instalar', () => {
    // Sem registro nenhum não há streak, e a trilha não mostra semanas
    // anteriores à instalação: elas não são constância que a pessoa falhou.
    expect(semanasEmDia(estadoVazio)).toBe(0);
    expect(historicoDeSemanas(estadoVazio)).toHaveLength(1);
    expect(estadoVazio.contexto.lancamentosMesAnterior).toBe(0);
    expect(estadoVazio.contexto.economiaBaseCentavos).toBe(0);
    expect(estadoVazio.orcamentoMensalCentavos).toBe(0);
  });

  it('começa com o onboarding pendente; a demo não', () => {
    expect(estadoVazio.onboardingConcluido).toBe(false);
    expect(criarEstadoDemo(estadoVazio.hoje).onboardingConcluido).toBe(true);
  });

  it('a semana fica inteira em aberto, sem quebrar', () => {
    const s = semana(estadoVazio);
    expect(s.registros).toBe(0);
    expect(s.emDia).toBe(false);
    expect(s.dias).toHaveLength(7);
  });

  it('metas e guardado ficam em zero', () => {
    expect(metas(estadoVazio)).toEqual([]);
  });
});

describe('onboarding', () => {
  const preencher = (extras: Acao[] = []) =>
    aplicar(
      estadoVazio,
      { tipo: 'ONBOARDING_CAMPO', campo: 'nome', valor: 'Carlos' },
      { tipo: 'ONBOARDING_CAMPO', campo: 'contaNome', valor: 'Nubank' },
      { tipo: 'ONBOARDING_CAMPO', campo: 'contaDigitos', valor: '150000' },
      ...extras,
      { tipo: 'ONBOARDING_CONCLUIR' },
    );

  it('cria perfil e a primeira conta, com saldo em centavos inteiros', () => {
    const depois = preencher();

    expect(depois.perfil.nome).toBe('Carlos');
    expect(depois.contas).toHaveLength(1);
    expect(depois.contas[0].nome).toBe('Nubank');
    expect(depois.contas[0].saldoInicialCentavos).toBe(150000);
    expect(Number.isInteger(depois.contas[0].saldoInicialCentavos)).toBe(true);
    expect(depois.onboardingConcluido).toBe(true);
  });

  it('o rascunho já aponta para a conta criada', () => {
    // Sem isso o primeiro lançamento cairia numa conta que não existe.
    const depois = preencher();
    expect(depois.rascunho.contaId).toBe(depois.contas[0].id);
  });

  it('a meta é opcional', () => {
    expect(preencher().metas).toEqual([]);
  });

  it('cria a meta quando nome e alvo vêm preenchidos', () => {
    const depois = preencher([
      { tipo: 'ONBOARDING_CAMPO', campo: 'metaNome', valor: 'Reserva' },
      { tipo: 'ONBOARDING_CAMPO', campo: 'metaDigitos', valor: '500000' },
    ]);

    expect(depois.metas).toHaveLength(1);
    expect(depois.metas[0].nome).toBe('Reserva');
    expect(depois.metas[0].alvoCentavos).toBe(500000);
    expect(depois.metas[0].guardadoInicialCentavos).toBe(0);
  });

  it('não conclui sem nome', () => {
    const depois = aplicar(estadoVazio, { tipo: 'ONBOARDING_CONCLUIR' });
    expect(depois.onboardingConcluido).toBe(false);
    expect(depois.contas).toEqual([]);
  });

  it('conta e meta ganham ids do gerador, não do catálogo', () => {
    const depois = preencher([
      { tipo: 'ONBOARDING_CAMPO', campo: 'metaNome', valor: 'Reserva' },
      { tipo: 'ONBOARDING_CAMPO', campo: 'metaDigitos', valor: '500000' },
    ]);
    expect(depois.contas[0].id).not.toBe(depois.metas[0].id);
  });

  it('o loop de custo de oportunidade fecha na meta que a pessoa criou', () => {
    // O defeito que a demo escondia: o Simulador guardava num id fixo
    // (`'reserva'`, da semente), e meta de instalação de verdade tem id do
    // gerador. O botão que fecha o loop não achava destino e não fazia nada.
    const instalado = preencher([
      { tipo: 'ONBOARDING_CAMPO', campo: 'metaNome', valor: 'Reserva' },
      { tipo: 'ONBOARDING_CAMPO', campo: 'metaDigitos', valor: '500000' },
    ]);
    expect(instalado.metas[0].id).not.toBe('reserva');

    const depois = aplicar(
      instalado,
      { tipo: 'SIM_DEFINIR', digitos: '5000' },
      { tipo: 'SIM_GUARDAR' },
    );

    expect(metas(depois)[0].guardadoCentavos).toBe(5000);

    // Com uma conta só, a meta guarda nela mesma: o par soma zero e o saldo
    // não se move — o dinheiro não foi a lugar algum, só passou a ter dono.
    expect(depois.transacoes).toHaveLength(2);
    expect(saldoDaConta(depois.contas[0], depois.transacoes)).toBe(150000);
  });
});

describe('modo demo e apagar', () => {
  it('carregar a demo enche o app e marca o onboarding como feito', () => {
    const depois = aplicar(estadoVazio, { tipo: 'CARREGAR_DEMO' });
    expect(depois.transacoes.length).toBeGreaterThan(0);
    expect(depois.contas.length).toBeGreaterThan(0);
    expect(depois.onboardingConcluido).toBe(true);
  });

  it('apagar limpa o conteúdo mas não devolve ao cadastro', () => {
    const cheio = aplicar(estadoVazio, { tipo: 'CARREGAR_DEMO' });
    const vazio = aplicar(cheio, { tipo: 'APAGAR_DADOS' });

    expect(vazio.transacoes).toEqual([]);
    expect(vazio.contas).toEqual([]);
    // Quem já passou pelo início não volta para ele.
    expect(vazio.onboardingConcluido).toBe(true);
    expect(vazio.perfil).toEqual(cheio.perfil);
  });

  it('apagar oferece desfazer, e desfazer devolve tudo', () => {
    const cheio = aplicar(estadoVazio, { tipo: 'CARREGAR_DEMO' });
    const vazio = aplicar(cheio, { tipo: 'APAGAR_DADOS' });

    expect(vazio.toast?.acao?.rotulo).toBe('Desfazer');

    const restaurado = aplicar(vazio, vazio.toast!.acao!.acao);
    expect(restaurado.transacoes).toHaveLength(cheio.transacoes.length);
    expect(restaurado.contas).toHaveLength(cheio.contas.length);
  });
});

describe('desafios vêm do catálogo', () => {
  it('sem progresso gravado, valem os padrões de fábrica', () => {
    const { ativos, disponiveis } = desafios(estadoVazio);
    const padroesAtivos = definicoesDesafios.filter((d) => d.aceitoPorPadrao);

    expect(ativos).toHaveLength(padroesAtivos.length);
    expect(ativos.length + disponiveis.length).toBe(definicoesDesafios.length);
  });

  it('quem instalou hoje começa todo progresso em zero', () => {
    const manual = desafios(estadoVazio).ativos.filter((d) => !d.automatico);
    for (const d of manual) expect(d.atual).toBe(0);
  });

  it('desafio publicado depois aparece para quem já usava', () => {
    // Simula um usuário antigo: progresso só dos desafios que existiam.
    const antigo: Estado = {
      ...estadoVazio,
      progressoDesafios: [{ id: 'catg', aceito: true, progresso: 4 }],
    };
    const { ativos, disponiveis } = desafios(antigo);
    const conhecidos = [...ativos, ...disponiveis].map((d) => d.id);

    // Se a definição viesse do banco, só 'catg' apareceria.
    expect(conhecidos.sort()).toEqual(definicoesDesafios.map((d) => d.id).sort());
    expect(ativos.find((d) => d.id === 'catg')!.atual).toBe(4);
  });

  it('aceitar grava só o progresso, não a definição', () => {
    const depois = aplicar(estadoVazio, {
      tipo: 'ACEITAR_DESAFIO',
      desafioId: 'cafe',
      nome: '5 dias sem café fora',
    });

    expect(depois.progressoDesafios).toEqual([{ id: 'cafe', aceito: true, progresso: 0 }]);
  });

  it('avançar cria a linha de progresso quando ela ainda não existe', () => {
    const depois = aplicar(estadoVazio, {
      tipo: 'AVANCAR_DESAFIO',
      desafioId: 'assin',
      automatico: false,
      rotulo: 'Revisar as assinaturas',
    });

    expect(progressoDe(definicoesDesafios[2], depois.progressoDesafios).progresso).toBe(1);
  });

  it('desafio inexistente não cria lixo no progresso', () => {
    const depois = aplicar(estadoVazio, {
      tipo: 'AVANCAR_DESAFIO',
      desafioId: 'desafio-que-nao-existe',
      automatico: false,
      rotulo: 'x',
    });
    expect(depois.progressoDesafios).toEqual([]);
  });
});
