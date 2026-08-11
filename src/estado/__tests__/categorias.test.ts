import { hidratar, recortePersistido } from '../../dados/persistido';
import { categoria, categoriasPorTipo } from '../../dominio/categorias';
import { Acao, criarReducer, dependenciasDeTeste, Estado, estadoInicial } from '../store';

/**
 * Categorias como dado do usuário.
 *
 * Enquanto eram um `Record` de módulo, eram imutáveis por construção: "Nova
 * categoria" era um retângulo tracejado que não fazia nada, e renomear não
 * existia. O caminho da categoria órfã, que já existia por precaução, deixou de
 * ser hipótese no dia em que apagar virou possível.
 */

function aplicar(estado: Estado, ...acoes: Acao[]): Estado {
  return acoes.reduce(criarReducer(dependenciasDeTeste()), estado);
}

const criar = (estado: Estado, nome: string, tipo_: 'despesa' | 'receita' = 'despesa') =>
  aplicar(
    estado,
    { tipo: 'ABRIR_CATEGORIA' },
    { tipo: 'CADASTRO_CATEGORIA_NOME', valor: nome },
    { tipo: 'CADASTRO_CATEGORIA_TIPO', tipo_ },
    { tipo: 'SALVAR_CATEGORIA' },
  );

describe('criar categoria', () => {
  it('entra na lista e no seletor do tipo certo', () => {
    const depois = criar(estadoInicial, 'Pet');
    const nova = depois.categorias.find((c) => c.nome === 'Pet')!;

    expect(nova).toBeDefined();
    expect(nova.tipo).toBe('despesa');
    expect(categoriasPorTipo(depois.categorias, 'despesa').map((c) => c.id)).toContain(nova.id);
    expect(categoriasPorTipo(depois.categorias, 'receita').map((c) => c.id)).not.toContain(nova.id);
    expect(depois.folha).toBeNull();
  });

  it('ganha id do gerador, não do nome', () => {
    // Id derivado do nome quebraria ao renomear e colidiria entre duas pessoas
    // que criassem "Pet" — e ele é a chave que os lançamentos apontam.
    const depois = criar(estadoInicial, 'Pet');
    expect(depois.categorias.find((c) => c.nome === 'Pet')!.id).not.toBe('pet');
  });

  it('não cria sem nome', () => {
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_CATEGORIA' },
      { tipo: 'SALVAR_CATEGORIA' },
    );
    expect(depois.categorias).toHaveLength(estadoInicial.categorias.length);
  });

  it('abre já no tipo da aba em que a pessoa estava', () => {
    const aberta = aplicar(
      { ...estadoInicial, abaCategorias: 'receita' },
      { tipo: 'ABRIR_CATEGORIA' },
    );
    expect(aberta.cadastroCategoria.tipo).toBe('receita');
  });
});

describe('editar categoria', () => {
  it('renomear mantém o id, e o histórico vem junto', () => {
    // Se o id mudasse, todo lançamento de mercado viraria "Sem categoria".
    const antes = estadoInicial.transacoes.filter((t) => t.categoriaId === 'mercado').length;
    expect(antes).toBeGreaterThan(0);

    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_CATEGORIA', categoriaId: 'mercado' },
      { tipo: 'CADASTRO_CATEGORIA_NOME', valor: 'Compras' },
      { tipo: 'SALVAR_CATEGORIA' },
    );

    expect(depois.categorias.find((c) => c.id === 'mercado')!.nome).toBe('Compras');
    expect(depois.transacoes.filter((t) => t.categoriaId === 'mercado')).toHaveLength(antes);
    expect(categoria(depois.categorias, 'mercado').nome).toBe('Compras');
  });

  it('editar não cria categoria nova', () => {
    const depois = aplicar(
      estadoInicial,
      { tipo: 'ABRIR_CATEGORIA', categoriaId: 'mercado' },
      { tipo: 'CADASTRO_CATEGORIA_NOME', valor: 'Compras' },
      { tipo: 'SALVAR_CATEGORIA' },
    );
    expect(depois.categorias).toHaveLength(estadoInicial.categorias.length);
  });
});

describe('apagar categoria', () => {
  it('os lançamentos ficam e viram órfãos, não somem', () => {
    // Oposto de apagar conta: o gasto aconteceu e o dinheiro saiu, seja qual
    // for o rótulo. Some o rótulo, não o dinheiro.
    const doMercado = estadoInicial.transacoes.filter((t) => t.categoriaId === 'mercado').length;
    const depois = aplicar(estadoInicial, { tipo: 'APAGAR_CATEGORIA', categoriaId: 'mercado' });

    expect(depois.categorias.some((c) => c.id === 'mercado')).toBe(false);
    expect(depois.transacoes).toHaveLength(estadoInicial.transacoes.length);
    expect(depois.transacoes.filter((t) => t.categoriaId === 'mercado')).toHaveLength(doMercado);
    expect(categoria(depois.categorias, 'mercado').nome).toBe('Sem categoria');
  });

  it('o rascunho e o filtro não ficam apontando para o que sumiu', () => {
    const depois = aplicar(
      { ...estadoInicial, filtroCategoria: 'mercado' },
      { tipo: 'APAGAR_CATEGORIA', categoriaId: 'mercado' },
    );
    expect(depois.filtroCategoria).toBe('todas');
    expect(depois.categorias.some((c) => c.id === depois.rascunho.categoriaId)).toBe(true);
  });

  it('desfazer devolve a categoria', () => {
    const apagada = aplicar(estadoInicial, { tipo: 'APAGAR_CATEGORIA', categoriaId: 'mercado' });
    const restaurada = aplicar(apagada, apagada.toast!.acao!.acao);
    expect(restaurada.categorias).toHaveLength(estadoInicial.categorias.length);
  });

  it('a última do tipo não é apagável', () => {
    // Sem nenhuma categoria de despesa não há o que escolher ao lançar. É a
    // mesma regra da última conta — e é ela que faz "tabela vazia" no banco
    // significar sempre "instalação anterior à v6".
    const soUma: Estado = {
      ...estadoInicial,
      categorias: estadoInicial.categorias.filter(
        (c) => c.tipo !== 'despesa' || c.id === 'mercado',
      ),
    };
    const tentativa = aplicar(soUma, { tipo: 'APAGAR_CATEGORIA', categoriaId: 'mercado' });

    expect(tentativa.categorias.some((c) => c.id === 'mercado')).toBe(true);
    expect(tentativa.toast?.texto).toContain('única categoria');
  });

  it('transferência não é apagável — é ela que marca as pontas de um movimento', () => {
    const tentativa = aplicar(estadoInicial, {
      tipo: 'APAGAR_CATEGORIA',
      categoriaId: 'transferencia',
    });
    expect(tentativa).toBe(estadoInicial);
  });
});

describe('banco anterior à v6', () => {
  it('o boot repõe o catálogo de fábrica quando o disco não tem categoria', () => {
    // A v6 cria a tabela vazia de propósito: repetir 14 paths SVG dentro de uma
    // migration que nunca mais pode ser editada garantiria divergência entre a
    // cópia e o catálogo real.
    const vazio: Estado = { ...estadoInicial, categorias: [] };
    const hidratado = hidratar(vazio, { ...recortePersistido(vazio) }, estadoInicial.hoje);

    expect(hidratado.categorias.length).toBeGreaterThan(0);
    expect(hidratado.categorias.some((c) => c.id === 'mercado')).toBe(true);
  });

  it('não sobrescreve o que a pessoa já tem', () => {
    const hidratado = hidratar(
      estadoInicial,
      recortePersistido(criar(estadoInicial, 'Pet')),
      estadoInicial.hoje,
    );
    expect(hidratado.categorias.some((c) => c.nome === 'Pet')).toBe(true);
  });
});

describe('recategorizar', () => {
  const alvo = estadoInicial.transacoes.find((t) => t.categoriaId === 'mercado')!;

  it('troca a categoria do lançamento sem tocar no valor nem na data', () => {
    const depois = aplicar(estadoInicial, {
      tipo: 'RECATEGORIZAR',
      transacaoId: alvo.id,
      categoriaId: 'lazer',
    });
    const tx = depois.transacoes.find((t) => t.id === alvo.id)!;

    expect(tx.categoriaId).toBe('lazer');
    expect(tx.valorCentavos).toBe(alvo.valorCentavos);
    expect(tx.ocorridoEm).toBe(alvo.ocorridoEm);
    expect(depois.transacoes).toHaveLength(estadoInicial.transacoes.length);
  });

  it('desfazer volta para a categoria anterior', () => {
    const depois = aplicar(estadoInicial, {
      tipo: 'RECATEGORIZAR',
      transacaoId: alvo.id,
      categoriaId: 'lazer',
    });
    const desfeito = aplicar(depois, depois.toast!.acao!.acao);
    expect(desfeito.transacoes.find((t) => t.id === alvo.id)!.categoriaId).toBe('mercado');
  });

  it('resgata um lançamento órfão', () => {
    // É o caminho de volta que faltava: apagar categoria deixava a linha como
    // "Sem categoria" para sempre.
    const orfao = aplicar(estadoInicial, { tipo: 'APAGAR_CATEGORIA', categoriaId: 'mercado' });
    expect(categoria(orfao.categorias, alvo.categoriaId).nome).toBe('Sem categoria');

    const salvo = aplicar(orfao, {
      tipo: 'RECATEGORIZAR',
      transacaoId: alvo.id,
      categoriaId: 'lazer',
    });
    expect(categoria(salvo.categorias, salvo.transacoes.find((t) => t.id === alvo.id)!.categoriaId).nome).toBe(
      'Lazer',
    );
  });

  it('lançamento inexistente não mexe em nada', () => {
    expect(
      aplicar(estadoInicial, {
        tipo: 'RECATEGORIZAR',
        transacaoId: 'nao-existe',
        categoriaId: 'lazer',
      }),
    ).toBe(estadoInicial);
  });
});
