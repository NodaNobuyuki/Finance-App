/** @jest-environment node */
import { AGORA, inicioDaSemana } from '../../dominio/datas';
import { guardadoDaMeta } from '../../dominio/metas';
import { saldoTotal } from '../../dominio/saldo';
import { Acao, criarEstadoDemo, criarReducer, dependenciasDeTeste } from '../../estado/store';
import { semanaEstaFechada } from '../../estado/derivados';
import { MotorSQL } from '../motor';
import { recortePersistido } from '../persistido';
import { criarRepositorioSQL } from '../repositorioSQL';
import { criarMotorNode } from './motorNode';

/**
 * Fechar o app e reabrir.
 *
 * Os testes de contrato provam que cada campo sobrevive à ida e volta. Este
 * prova a coisa que o usuário sente: o que ele fez continua lá, e continua
 * significando o mesmo — saldo derivado igual, meta com o mesmo guardado,
 * ritual no mesmo estado.
 *
 * O truque é reaproveitar o MESMO motor entre as duas sessões, que é o que um
 * arquivo de banco no aparelho faz.
 */

async function sessao(motor: MotorSQL, acoes: Acao[] = []) {
  const repo = criarRepositorioSQL(motor);
  await repo.iniciar();

  const salvo = await repo.carregar();
  const base = criarEstadoDemo(AGORA);
  let estado = salvo ? { ...base, ...salvo } : base;
  if (!salvo) await repo.salvar(null, recortePersistido(estado));

  const reducer = criarReducer(dependenciasDeTeste());
  for (const acao of acoes) {
    const anterior = recortePersistido(estado);
    estado = reducer(estado, acao);
    await repo.salvar(anterior, recortePersistido(estado));
  }

  return estado;
}

describe('fechar e reabrir', () => {
  it('o lançamento continua lá', async () => {
    const motor = criarMotorNode();
    const antes = await sessao(motor, [
      { tipo: 'REGISTRO_RAPIDO', categoriaId: 'mercado', valorCentavos: 2000 },
    ]);
    const depois = await sessao(motor);

    expect(depois.transacoes).toHaveLength(antes.transacoes.length);
    expect(depois.transacoes.some((t) => t.valorCentavos === -2000)).toBe(true);
  });

  it('o saldo derivado bate depois de reabrir', async () => {
    const motor = criarMotorNode();
    const antes = await sessao(motor, [
      { tipo: 'REGISTRO_RAPIDO', categoriaId: 'mercado', valorCentavos: 2000 },
      { tipo: 'REGISTRO_RAPIDO', categoriaId: 'lazer', valorCentavos: 5500 },
    ]);
    const depois = await sessao(motor);

    expect(saldoTotal(depois.contas, depois.transacoes)).toBe(
      saldoTotal(antes.contas, antes.transacoes),
    );
  });

  it('desfazer antes de fechar não deixa rastro no banco', async () => {
    const motor = criarMotorNode();
    const inicial = criarEstadoDemo(AGORA);

    const comRegistro = await sessao(motor, [
      { tipo: 'REGISTRO_RAPIDO', categoriaId: 'mercado', valorCentavos: 2000 },
    ]);
    await sessao(motor, [comRegistro.toast!.acao!.acao]);
    const depois = await sessao(motor);

    expect(depois.transacoes).toHaveLength(inicial.transacoes.length);
  });

  it('o guardado da meta sobrevive ao aporte', async () => {
    const motor = criarMotorNode();
    const antes = await sessao(motor, [
      { tipo: 'ABRIR_APORTE', metaId: 'reserva' },
      { tipo: 'DEFINIR_DIGITOS', digitos: '25000' },
      { tipo: 'CONFIRMAR_APORTE' },
    ]);
    const depois = await sessao(motor);

    const meta = (e: typeof depois) => e.metas.find((m) => m.id === 'reserva')!;
    expect(guardadoDaMeta(meta(depois), depois.aportes)).toBe(
      guardadoDaMeta(meta(antes), antes.aportes),
    );
    expect(depois.aportes).toHaveLength(1);
  });

  it('a semana fechada continua fechada — e sabe qual era', async () => {
    const motor = criarMotorNode();
    await sessao(motor, [
      { tipo: 'FECHAR_INICIAR' },
      { tipo: 'FECHAR_INTENCAO', id: 'delivery', nome: 'Menos delivery' },
      { tipo: 'FECHAR_CONCLUIR' },
    ]);
    const depois = await sessao(motor);

    expect(depois.semanaFechada).toBe(inicioDaSemana(AGORA));
    expect(semanaEstaFechada(depois)).toBe(true);
    expect(depois.intencao).toBe('Menos delivery');
  });

  it('o lote fecha os dias e eles continuam fechados', async () => {
    const motor = criarMotorNode();
    const pendentes = ['2026-08-04', '2026-08-05'];
    await sessao(motor, [
      { tipo: 'LOTE_VALOR', dia: pendentes[0], texto: '42,50' },
      { tipo: 'LOTE_SEM_GASTO', dia: pendentes[1] },
      { tipo: 'SALVAR_LOTE', pendentes },
    ]);
    const depois = await sessao(motor);

    // A demo já traz dias sem gasto das semanas anteriores — é deles que sai a
    // trilha de constância. O que este teste guarda é que os dois dias fechados
    // agora entraram, sem duplicar nada, e sobreviveram a fechar e reabrir.
    expect(depois.diasSemGasto).toEqual(expect.arrayContaining(pendentes));
    expect(depois.diasSemGasto).toHaveLength(criarEstadoDemo(AGORA).diasSemGasto.length + 2);
    expect(new Set(depois.diasSemGasto).size).toBe(depois.diasSemGasto.length);
    expect(depois.transacoes.some((t) => t.valorCentavos === -4250)).toBe(true);
  });

  it('ajuste do ritual sobrevive', async () => {
    const motor = criarMotorNode();
    await sessao(motor, [
      { tipo: 'RITUAL_DIA', dia: 'sexta' },
      { tipo: 'RITUAL_META', meta: 6 },
      { tipo: 'LEMBRETE', id: 'diario' },
    ]);
    const depois = await sessao(motor);

    expect(depois.ritualDiaFechamento).toBe('sexta');
    expect(depois.metaSemanal).toBe(6);
    expect(depois.lembrete).toBe('diario');
  });

  it('desafio aceito continua aceito, com o progresso que tinha', async () => {
    const motor = criarMotorNode();
    await sessao(motor, [
      { tipo: 'ACEITAR_DESAFIO', desafioId: 'cafe', nome: '5 dias sem café fora' },
      { tipo: 'AVANCAR_DESAFIO', desafioId: 'cafe', automatico: false, rotulo: 'x' },
      { tipo: 'AVANCAR_DESAFIO', desafioId: 'cafe', automatico: false, rotulo: 'x' },
    ]);
    const depois = await sessao(motor);

    const cafe = depois.progressoDesafios.find((d) => d.id === 'cafe')!;
    expect(cafe.aceito).toBe(true);
    expect(cafe.progresso).toBe(2);
  });

  it('reabrir várias vezes não multiplica nada', async () => {
    const motor = criarMotorNode();
    await sessao(motor, [{ tipo: 'REGISTRO_RAPIDO', categoriaId: 'mercado', valorCentavos: 2000 }]);

    const primeira = await sessao(motor);
    const segunda = await sessao(motor);
    const terceira = await sessao(motor);

    expect(segunda.transacoes).toHaveLength(primeira.transacoes.length);
    expect(terceira.transacoes).toHaveLength(primeira.transacoes.length);
    expect(terceira.contas).toHaveLength(primeira.contas.length);
    expect(terceira.metas).toHaveLength(primeira.metas.length);
  });
});
