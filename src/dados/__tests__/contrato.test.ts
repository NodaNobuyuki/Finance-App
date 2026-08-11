/** @jest-environment node */
import { AGORA, inicioDaSemana } from '../../dominio/datas';
import { Transacao } from '../../dominio/tipos';
import { criarEstadoDemo } from '../../estado/store';
import { EstadoPersistido, recortePersistido } from '../persistido';
import { RepositorioLocal } from '../repositorio';
import { criarRepositorioMemoria } from '../repositorioMemoria';
import { criarRepositorioSQL } from '../repositorioSQL';
import { criarMotorNode } from './motorNode';

/**
 * Testes de CONTRATO: a mesma suíte roda contra as duas implementações.
 *
 * É o que dá o direito de usar o repositório de memória nos testes de tela.
 * Sem isto, ele seria uma conveniência que se comporta diferente do banco real
 * — e a divergência só apareceria no aparelho de alguém.
 */

const base = (): EstadoPersistido => recortePersistido(criarEstadoDemo(AGORA));

const tx = (id: string, valorCentavos: number): Transacao => ({
  id,
  contaId: 'cartao',
  categoriaId: 'mercado',
  valorCentavos,
  ocorridoEm: AGORA,
  descricao: 'teste',
  origem: 'manual',
  criadoEm: 5_000_000,
});

const implementacoes: [string, () => RepositorioLocal][] = [
  ['memória', criarRepositorioMemoria],
  ['sqlite', () => criarRepositorioSQL(criarMotorNode())],
];

describe.each(implementacoes)('repositório: %s', (_nome, criar) => {
  let repo: RepositorioLocal;

  beforeEach(async () => {
    repo = criar();
    await repo.iniciar();
  });

  afterEach(async () => {
    await repo.fechar();
  });

  it('banco novo devolve null — é o sinal de primeiro uso', async () => {
    expect(await repo.carregar()).toBeNull();
  });

  it('grava e relê o estado inteiro', async () => {
    const estado = base();
    await repo.salvar(null, estado);
    const lido = await repo.carregar();

    expect(lido).not.toBeNull();
    expect(lido!.transacoes).toHaveLength(estado.transacoes.length);
    expect(lido!.contas).toHaveLength(estado.contas.length);
    expect(lido!.metas).toHaveLength(estado.metas.length);
    expect(lido!.progressoDesafios).toHaveLength(estado.progressoDesafios.length);
    expect(lido!.diasSemGasto).toEqual(estado.diasSemGasto);
    expect(lido!.perfil).toEqual(estado.perfil);
  });

  it('dinheiro volta como inteiro, nunca como float', async () => {
    const estado = base();
    await repo.salvar(null, estado);
    const lido = await repo.carregar();

    for (const t of lido!.transacoes) expect(Number.isInteger(t.valorCentavos)).toBe(true);
    for (const c of lido!.contas) expect(Number.isInteger(c.saldoInicialCentavos)).toBe(true);
    for (const m of lido!.metas) expect(Number.isInteger(m.alvoCentavos)).toBe(true);
    expect(Number.isInteger(lido!.orcamentoMensalCentavos)).toBe(true);
  });

  it('preserva o sinal de saída e o valor exato', async () => {
    const estado = { ...base(), transacoes: [tx('t1', -28790), tx('t2', 162000)] };
    await repo.salvar(null, estado);
    const lido = await repo.carregar();

    const porId = new Map(lido!.transacoes.map((t) => [t.id, t.valorCentavos]));
    expect(porId.get('t1')).toBe(-28790);
    expect(porId.get('t2')).toBe(162000);
  });

  it('insere só o que é novo', async () => {
    const antes = { ...base(), transacoes: [tx('t1', -100)] };
    await repo.salvar(null, antes);

    const depois = { ...antes, transacoes: [tx('t2', -200), ...antes.transacoes] };
    await repo.salvar(antes, depois);

    const lido = await repo.carregar();
    expect(lido!.transacoes.map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('remoção de linha chega ao disco — desfazer não pode ressuscitar', async () => {
    const antes = { ...base(), transacoes: [tx('t1', -100), tx('t2', -200)] };
    await repo.salvar(null, antes);

    const depois = { ...antes, transacoes: [tx('t1', -100)] };
    await repo.salvar(antes, depois);

    const lido = await repo.carregar();
    expect(lido!.transacoes.map((t) => t.id)).toEqual(['t1']);
  });

  it('atualização troca o valor, não duplica a linha', async () => {
    const antes = { ...base(), transacoes: [tx('t1', -100)] };
    await repo.salvar(null, antes);

    const depois = { ...antes, transacoes: [{ ...tx('t1', -999), descricao: 'corrigida' }] };
    await repo.salvar(antes, depois);

    const lido = await repo.carregar();
    expect(lido!.transacoes).toHaveLength(1);
    expect(lido!.transacoes[0].valorCentavos).toBe(-999);
    expect(lido!.transacoes[0].descricao).toBe('corrigida');
  });

  it('escalares voltam com o tipo certo, inclusive null', async () => {
    const estado = { ...base(), semanaFechada: null, metaSemanal: 6, mostrarSaldo: false };
    await repo.salvar(null, estado);
    const lido = await repo.carregar();

    // Se isto virasse a string "null", `semanaEstaFechada` compararia texto com
    // data e o ritual nunca mais abriria.
    expect(lido!.semanaFechada).toBeNull();
    expect(lido!.metaSemanal).toBe(6);
    expect(lido!.mostrarSaldo).toBe(false);
  });

  it('semana fechada volta como a data, não como sim/não', async () => {
    const fechada = inicioDaSemana(AGORA);
    await repo.salvar(null, { ...base(), semanaFechada: fechada });
    expect((await repo.carregar())!.semanaFechada).toBe(fechada);
  });

  it('objeto aninhado (contexto) sobrevive à ida e volta', async () => {
    const estado = base();
    await repo.salvar(null, estado);
    expect((await repo.carregar())!.contexto).toEqual(estado.contexto);
  });

  it('cor de conta e meta sobrevive — token e hex', async () => {
    const estado = base();
    await repo.salvar(null, estado);
    const lido = await repo.carregar();

    const porId = new Map(lido!.contas.map((c) => [c.id, c.cor]));
    for (const c of estado.contas) expect(porId.get(c.id)).toEqual(c.cor);
  });

  it('booleano de desafio não vira número na volta', async () => {
    const estado = {
      ...base(),
      progressoDesafios: [
        { id: 'cafe', aceito: true, progresso: 3 },
        { id: 'uber', aceito: false, progresso: 0 },
      ],
    };
    await repo.salvar(null, estado);
    const lido = await repo.carregar();

    const porId = new Map(lido!.progressoDesafios.map((d) => [d.id, d]));
    expect(porId.get('cafe')).toEqual({ id: 'cafe', aceito: true, progresso: 3 });
    expect(typeof porId.get('uber')!.aceito).toBe('boolean');
  });

  it('só o progresso é gravado — a definição do desafio é catálogo', async () => {
    const estado = { ...base(), progressoDesafios: [{ id: 'cafe', aceito: true, progresso: 3 }] };
    await repo.salvar(null, estado);
    const lido = await repo.carregar();

    // Se nome/alvo voltassem do banco, desafio novo publicado numa versão
    // seguinte nunca chegaria a quem já instalou.
    expect(Object.keys(lido!.progressoDesafios[0]).sort()).toEqual(['aceito', 'id', 'progresso']);
  });

  it('campo opcional ausente não volta como null', async () => {
    const semOpcionais = tx('t1', -100);
    await repo.salvar(null, { ...base(), transacoes: [semOpcionais] });
    const lido = await repo.carregar();

    expect(lido!.transacoes[0].idExterno).toBeUndefined();
    expect(lido!.transacoes[0].descricaoOriginal).toBeUndefined();
  });

  it('dias sem gasto entram e saem', async () => {
    const antes = { ...base(), diasSemGasto: ['2026-08-04', '2026-08-05'] };
    await repo.salvar(null, antes);
    expect((await repo.carregar())!.diasSemGasto).toEqual(['2026-08-04', '2026-08-05']);

    const depois = { ...antes, diasSemGasto: ['2026-08-04'] };
    await repo.salvar(antes, depois);
    expect((await repo.carregar())!.diasSemGasto).toEqual(['2026-08-04']);
  });

  it('as duas pontas de uma transferência sobrevivem juntas', async () => {
    // Meia transferência gravada seria pior que nenhuma: o saldo derivado
    // passaria a somar um lançamento sem par.
    const estado = base();
    const par: Transacao[] = [
      { ...tx('tr-saida', -10000), transferenciaId: 'tr-1', categoriaId: 'transferencia' },
      {
        ...tx('tr-entrada', 10000),
        transferenciaId: 'tr-1',
        metaId: 'reserva',
        categoriaId: 'transferencia',
      },
    ];
    await repo.salvar(null, { ...estado, transacoes: par });
    const lido = await repo.carregar();

    const lidas = lido!.transacoes.filter((t) => t.transferenciaId === 'tr-1');
    expect(lidas).toHaveLength(2);
    expect(lidas.reduce((a, t) => a + t.valorCentavos, 0)).toBe(0);
    expect(lidas.filter((t) => t.metaId === 'reserva')).toHaveLength(1);
    // A ponta de saída não pode voltar com `metaId`: ela contaria como
    // guardado e dobraria o total da meta.
    expect(lidas.find((t) => t.valorCentavos < 0)!.metaId).toBeUndefined();
  });

  it('lançamento comum volta sem os campos de transferência', async () => {
    await repo.salvar(null, { ...base(), transacoes: [tx('t1', -2500)] });
    const lida = (await repo.carregar())!.transacoes[0];

    expect(lida.transferenciaId).toBeUndefined();
    expect(lida.metaId).toBeUndefined();
  });

  it('a meta guarda onde o dinheiro dela fica', async () => {
    await repo.salvar(null, base());
    const lida = (await repo.carregar())!.metas.find((m) => m.id === 'reserva')!;
    expect(lida.contaId).toBe('poupanca');
  });

  it('salvar duas vezes o mesmo estado não duplica nada', async () => {
    const estado = base();
    await repo.salvar(null, estado);
    await repo.salvar(estado, estado);

    const lido = await repo.carregar();
    expect(lido!.transacoes).toHaveLength(estado.transacoes.length);
    expect(lido!.contas).toHaveLength(estado.contas.length);
  });

  it('apagarTudo devolve o banco ao primeiro uso', async () => {
    await repo.salvar(null, base());
    await repo.apagarTudo();
    expect(await repo.carregar()).toBeNull();
  });

  it('o que sai de carregar não é o mesmo array que entrou', async () => {
    // Mutação acidental no estado vivo não pode alcançar o que está salvo.
    const estado = base();
    await repo.salvar(null, estado);
    const lido = await repo.carregar();
    expect(lido!.transacoes).not.toBe(estado.transacoes);
  });
});
