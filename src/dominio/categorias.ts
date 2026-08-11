import { CorRef, hex, token } from '../tema/paletas';

/**
 * `transferencia` não é despesa nem receita: é dinheiro seu mudando de lugar.
 *
 * Existe como tipo próprio para ficar de fora de `categoriasDespesa` e
 * `categoriasReceita` sozinha — assim ela não aparece no seletor de lançamento
 * nem na tela Categorias, que é onde ela não faz sentido nenhum.
 */
export type TipoCategoria = 'despesa' | 'receita' | 'transferencia';

/** Categoria das duas pontas de uma transferência. */
export const CATEGORIA_TRANSFERENCIA = 'transferencia';

export type Categoria = {
  id: string;
  nome: string;
  tipo: TipoCategoria;
  cor: CorRef;
  /** Path SVG 24×24, traçado — o mesmo vocabulário visual do protótipo. */
  icone: string;
};

/**
 * Catálogo de FÁBRICA — semente, não fonte de consulta.
 *
 * Quem lê daqui é `criarEstadoInicial` e a migration v6, e mais ninguém: as
 * categorias moram em `Estado.categorias` porque são dado do usuário, que pode
 * criar, renomear e apagar. Enquanto isto era um `Record` de módulo, elas eram
 * imutáveis por construção e "Nova categoria" não tinha onde gravar.
 *
 * Continua sendo o ponto de partida de toda instalação nova, e é por isso que
 * segue em código em vez de vir do banco vazio.
 */
export const categoriasDeFabrica: Record<string, Categoria> = {
  mercado: {
    id: 'mercado',
    nome: 'Mercado',
    tipo: 'despesa',
    cor: token('up'),
    icone:
      'M6 6h15l-1.6 9H7.5zM6 6L5.2 3H2M9.5 20a1 1 0 100-2 1 1 0 000 2M18 20a1 1 0 100-2 1 1 0 000 2',
  },
  restaurante: {
    id: 'restaurante',
    nome: 'Restaurante',
    tipo: 'despesa',
    cor: hex('#c0562b'),
    icone: 'M6 3v7a2 2 0 004 0V3M8 10v11M17 3c-1.4 2-2 4-2 6h4c0-2-.6-4-2-6zM17 9v12',
  },
  transporte: {
    id: 'transporte',
    nome: 'Transporte',
    tipo: 'despesa',
    cor: hex('#2f6f8f'),
    icone:
      'M5 13l1.6-4.6A2 2 0 018.5 7h7a2 2 0 011.9 1.4L19 13v5h-3v-2H8v2H5zM7.6 15.4h.01M16.4 15.4h.01',
  },
  casa: {
    id: 'casa',
    nome: 'Casa',
    tipo: 'despesa',
    cor: token('accent'),
    icone: 'M3 10.5L12 3l9 7.5V21H3zM9.5 21v-6h5v6',
  },
  saude: {
    id: 'saude',
    nome: 'Saúde',
    tipo: 'despesa',
    cor: hex('#b03a5b'),
    icone: 'M12 20s-7-4.4-7-9.4A3.6 3.6 0 0112 8a3.6 3.6 0 017 2.6c0 5-7 9.4-7 9.4z',
  },
  lazer: {
    id: 'lazer',
    nome: 'Lazer',
    tipo: 'despesa',
    cor: hex('#6b4e9e'),
    icone: 'M9 18V5l10-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM19 16a3 3 0 11-6 0 3 3 0 016 0z',
  },
  educacao: {
    id: 'educacao',
    nome: 'Educação',
    tipo: 'despesa',
    cor: hex('#3c6e5b'),
    icone: 'M4 4h6.5a2 2 0 012 2v14a2 2 0 00-2-2H4zM20 4h-6.5a2 2 0 00-2 2v14a2 2 0 012-2H20z',
  },
  contas: {
    id: 'contas',
    nome: 'Contas',
    tipo: 'despesa',
    cor: hex('#8a6d3b'),
    icone: 'M6 2h9l4 4v16l-3-2-3 2-3-2-3 2zM9 9h6M9 13h6M9 17h4',
  },
  assinaturas: {
    id: 'assinaturas',
    nome: 'Assinaturas',
    tipo: 'despesa',
    cor: hex('#4a5f8a'),
    icone: 'M4 9a5 5 0 015-5h9M18 4l3 3-3 3M20 15a5 5 0 01-5 5H6M6 20l-3-3 3-3',
  },
  salario: {
    id: 'salario',
    nome: 'Salário',
    tipo: 'receita',
    cor: token('up'),
    icone: 'M3 8h15a3 3 0 013 3v6a3 3 0 01-3 3H6a3 3 0 01-3-3zM3 8V7a2 2 0 012-2h11M17 14h.01',
  },
  freela: {
    id: 'freela',
    nome: 'Freela',
    tipo: 'receita',
    cor: hex('#3c6e5b'),
    icone: 'M3 8h18v11H3zM8.5 8V5h7v3M3 13h18',
  },
  presente: {
    id: 'presente',
    nome: 'Presente',
    tipo: 'receita',
    cor: hex('#b03a5b'),
    icone:
      'M3 11h18v10H3zM3 7h18v4H3zM12 7v14M12 7S9.6 7 8.6 6s-.4-2.5 1-2.5S12 7 12 7zM12 7s2.4 0 3.4-1 .4-2.5-1-2.5S12 7 12 7z',
  },
  investimento: {
    id: 'investimento',
    nome: 'Investimento',
    tipo: 'receita',
    cor: hex('#2f6f8f'),
    icone: 'M4 19V9M10 19V5M16 19v-6M22 19H2',
  },
  [CATEGORIA_TRANSFERENCIA]: {
    id: CATEGORIA_TRANSFERENCIA,
    nome: 'Transferência',
    tipo: 'transferencia',
    cor: token('inkSoft'),
    icone: 'M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4',
  },
};

/** A semente, na ordem em que aparece nas telas. */
export const categoriasIniciais = (): Categoria[] => Object.values(categoriasDeFabrica);

/**
 * Só o que a pessoa pode escolher ao lançar.
 *
 * `transferencia` fica de fora sozinha, pelo tipo: ela é das duas pontas de um
 * movimento entre contas e não faz sentido num seletor de despesa.
 */
export function categoriasPorTipo(
  categorias: Categoria[],
  tipo: 'despesa' | 'receita',
): Categoria[] {
  return categorias.filter((c) => c.tipo === tipo);
}

/**
 * Placeholder para lançamento cuja categoria não existe mais.
 *
 * Preserva o id original para que a linha continue rastreável e possa ser
 * recategorizada, em vez de virar um registro anônimo.
 */
function categoriaOrfa(id: string): Categoria {
  return {
    id,
    nome: 'Sem categoria',
    tipo: 'despesa',
    cor: token('inkFaint'),
    icone: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v5M12 16.5h.01',
  };
}

/**
 * Nunca lança.
 *
 * Já lançou, e enquanto o catálogo era fixo isso nunca acontecia. Com dado
 * gravado em disco, basta UMA linha apontando para categoria removida para
 * derrubar o Extrato inteiro — a tela mapeia a lista toda, e uma exceção no
 * meio leva junto tudo que já tinha renderizado. Perder a cor de um item é
 * incomparavelmente melhor que perder a tela.
 */
export function categoria(categorias: Categoria[], id: string): Categoria {
  return categorias.find((c) => c.id === id) ?? categoriaOrfa(id);
}

/** O id existe na lista? Para quem precisa decidir, não só exibir. */
export function categoriaExisteEm(categorias: Categoria[], id: string): boolean {
  return categorias.some((c) => c.id === id);
}

/**
 * Paleta oferecida ao criar categoria. Tokens do tema, nunca hex cravado:
 * categoria criada pelo usuário troca de cor junto com a paleta, como o resto.
 */
export const coresDeCategoria: CorRef[] = [
  token('accent'),
  token('up'),
  token('down'),
  token('atencao'),
  hex('#2f6f8f'),
  hex('#8a6d3b'),
  hex('#b03a5b'),
  hex('#3c6e5b'),
];

/** Ícones oferecidos ao criar categoria — os mesmos do catálogo de fábrica. */
export const iconesDeCategoria: string[] = [
  ...new Set(Object.values(categoriasDeFabrica).map((c) => c.icone)),
];

/** Ícones avulsos da interface, no mesmo formato das categorias. */
export const icones = {
  inicio: 'M3 10.5L12 3l9 7.5V21H3zM9.5 21v-6h5v6',
  extrato: 'M5 3h14v18H5zM9 8h6M9 12h6M9 16h4',
  habitos:
    'M12 3c1.2 3 4.5 4.2 4.5 8a4.5 4.5 0 01-9 0c0-1.6.7-2.6 1.5-3.5.3 1.2 1 1.8 1.8 1.8-.6-2.4-.4-4.6 1.2-6.3z',
  metas:
    'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 13.2a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4',
  mais: 'M12 5v14M5 12h14',
  check: 'M20 6L9 17l-5-5',
  voltar: 'M15 5l-7 7 7 7',
  fechar: 'M18 6L6 18M6 6l12 12',
  grafico: 'M3 17l6-6 4 4 8-8M21 7h-5M21 7v5',
  lampada:
    'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.5.4.8 1 .8 1.6h5.4c0-.6.3-1.2.8-1.6A6 6 0 0012 3z',
  calendario: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  calendarioOk: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M9.2 15.4l1.9 1.9 3.7-3.9',
  calendarioMais: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4M12 13v4M10 15h4',
  relogio: 'M12 8v4.6l3 1.8M21 12a9 9 0 11-9-9',
  desfazer: 'M3 8h11a5 5 0 010 10H8M3 8l4-4M3 8l4 4',
  lixeira: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  lapis: 'M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17zM14 6l4 4',
  transferir: 'M4 8h13M13 4l4 4-4 4M20 16H7M11 12l-4 4 4 4',
} as const;
