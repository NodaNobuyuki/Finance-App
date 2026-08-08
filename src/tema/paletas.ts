/**
 * Paletas do Poupa.
 *
 * React Native não tem CSS variables, então o equivalente é este objeto de
 * tokens: nenhum componente escreve cor literal, todos leem de `useTema()`.
 * Trocar a paleta é trocar o objeto — nada mais.
 */

export type Tokens = {
  canvas: string;
  surface: string;
  surfaceMuted: string;
  segment: string;
  ink: string;
  inkMuted: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  lineSoft: string;
  lineInput: string;
  up: string;
  down: string;
  accent: string;
  accentHover: string;
  accentSoft: string;
  onAccent: string;
  toastBg: string;
  toastInk: string;
  toastCheck: string;
  accentShadow: string;
  hero: string;
  onHero: string;
  onHeroSoft: string;
  heroLine: string;
  /** Estado "atenção" (dia em aberto, orçamento no limite). Não é erro, é aviso. */
  atencao: string;
};

export type Paleta = {
  rotulo: string;
  escuro: boolean;
  tokens: Tokens;
};

export type PaletaId =
  | 'bloco'
  | 'marinho'
  | 'ameixa'
  | 'terracota'
  | 'lima'
  | 'verde'
  | 'papel'
  | 'gelo'
  | 'grafite'
  | 'meianoite'
  | 'ameixaNoite'
  | 'floresta'
  | 'oled';

const ATENCAO_CLARO = '#d9a13a';
const ATENCAO_ESCURO = '#e8b957';

export const paletas: Record<PaletaId, Paleta> = {
  bloco: {
    rotulo: 'Bloco indigo',
    escuro: false,
    tokens: {
      canvas: '#ffffff', surface: '#ffffff', surfaceMuted: '#fafaf9', segment: '#f1f0f9',
      ink: '#17140f', inkMuted: '#77726a', inkSoft: '#8a8a86', inkFaint: '#a09a90',
      line: '#f2f0eb', lineSoft: '#f2f0eb', lineInput: '#e6e2db',
      up: '#0f7a43', down: '#c0392b', accent: '#2b2a66', accentHover: '#1f1e4d',
      accentSoft: '#f1f0f9', onAccent: '#ffffff', toastBg: '#17140f', toastInk: '#ffffff',
      toastCheck: '#7fd8a4', accentShadow: 'rgba(43,42,102,.35)',
      hero: '#2b2a66', onHero: '#ffffff', onHeroSoft: 'rgba(255,255,255,.64)',
      heroLine: 'rgba(255,255,255,.3)', atencao: ATENCAO_CLARO,
    },
  },
  marinho: {
    rotulo: 'Marinho e areia',
    escuro: false,
    tokens: {
      canvas: '#f7f5f1', surface: '#ffffff', surfaceMuted: '#fbf9f6', segment: '#eae5dd',
      ink: '#101a26', inkMuted: '#6a7480', inkSoft: '#838c97', inkFaint: '#9aa2ab',
      line: '#e7e2da', lineSoft: '#f1ede6', lineInput: '#d8d2c9',
      up: '#0f7a43', down: '#c0392b', accent: '#123055', accentHover: '#0c2340',
      accentSoft: '#eaeef4', onAccent: '#ffffff', toastBg: '#101a26', toastInk: '#ffffff',
      toastCheck: '#7fd8a4', accentShadow: 'rgba(18,48,85,.35)',
      hero: '#123055', onHero: '#ffffff', onHeroSoft: 'rgba(255,255,255,.64)',
      heroLine: 'rgba(255,255,255,.3)', atencao: ATENCAO_CLARO,
    },
  },
  ameixa: {
    rotulo: 'Ameixa',
    escuro: false,
    tokens: {
      canvas: '#ffffff', surface: '#ffffff', surfaceMuted: '#fbf9fb', segment: '#f3ecf5',
      ink: '#1b1119', inkMuted: '#746b76', inkSoft: '#8a8189', inkFaint: '#a49ba5',
      line: '#f1ebf2', lineSoft: '#f6f1f7', lineInput: '#e3d9e5',
      up: '#0f7a43', down: '#c0392b', accent: '#4a1d52', accentHover: '#351239',
      accentSoft: '#f3ecf5', onAccent: '#ffffff', toastBg: '#1b1119', toastInk: '#ffffff',
      toastCheck: '#7fd8a4', accentShadow: 'rgba(74,29,82,.33)',
      hero: '#4a1d52', onHero: '#ffffff', onHeroSoft: 'rgba(255,255,255,.66)',
      heroLine: 'rgba(255,255,255,.3)', atencao: ATENCAO_CLARO,
    },
  },
  terracota: {
    rotulo: 'Terracota',
    escuro: false,
    tokens: {
      canvas: '#fdfaf7', surface: '#ffffff', surfaceMuted: '#fdf7f3', segment: '#f7e9e1',
      ink: '#1f150f', inkMuted: '#7a6b61', inkSoft: '#8d7d72', inkFaint: '#a5968b',
      line: '#f2e7de', lineSoft: '#f8f1eb', lineInput: '#e3d5c9',
      up: '#0f7a43', down: '#c0392b', accent: '#b8431f', accentHover: '#973516',
      accentSoft: '#fbeae2', onAccent: '#ffffff', toastBg: '#1f150f', toastInk: '#ffffff',
      toastCheck: '#7fd8a4', accentShadow: 'rgba(184,67,31,.32)',
      hero: '#b8431f', onHero: '#ffffff', onHeroSoft: 'rgba(255,255,255,.7)',
      heroLine: 'rgba(255,255,255,.32)', atencao: ATENCAO_CLARO,
    },
  },
  lima: {
    rotulo: 'Preto e lima',
    escuro: false,
    tokens: {
      canvas: '#ffffff', surface: '#ffffff', surfaceMuted: '#f9faf4', segment: '#eef4dc',
      ink: '#14150f', inkMuted: '#6f7266', inkSoft: '#85887b', inkFaint: '#9ea297',
      line: '#eff0e9', lineSoft: '#f5f6f0', lineInput: '#dfe1d6',
      up: '#0f7a43', down: '#c0392b', accent: '#14150f', accentHover: '#000000',
      accentSoft: '#eef4dc', onAccent: '#d3f26b', toastBg: '#14150f', toastInk: '#d3f26b',
      toastCheck: '#d3f26b', accentShadow: 'rgba(20,21,15,.3)',
      hero: '#d3f26b', onHero: '#14150f', onHeroSoft: 'rgba(20,21,15,.62)',
      heroLine: 'rgba(20,21,15,.18)', atencao: '#a06a12',
    },
  },
  verde: {
    rotulo: 'Bloco verde',
    escuro: false,
    tokens: {
      canvas: '#ffffff', surface: '#ffffff', surfaceMuted: '#fafaf9', segment: '#eef4f0',
      ink: '#121a16', inkMuted: '#6b7570', inkSoft: '#828b86', inkFaint: '#9aa29d',
      line: '#f0f2f0', lineSoft: '#f0f2f0', lineInput: '#e0e6e2',
      up: '#0f7a43', down: '#c0392b', accent: '#12452f', accentHover: '#0c3423',
      accentSoft: '#eef4f0', onAccent: '#ffffff', toastBg: '#12452f', toastInk: '#ffffff',
      toastCheck: '#7fd8a4', accentShadow: 'rgba(18,69,47,.35)',
      hero: '#12452f', onHero: '#ffffff', onHeroSoft: 'rgba(255,255,255,.64)',
      heroLine: 'rgba(255,255,255,.3)', atencao: ATENCAO_CLARO,
    },
  },
  papel: {
    rotulo: 'Papel quente',
    escuro: false,
    tokens: {
      canvas: '#f4f2ee', surface: '#ffffff', surfaceMuted: '#faf8f4', segment: '#eae6de',
      ink: '#17140f', inkMuted: '#77726a', inkSoft: '#8a8a86', inkFaint: '#a09a90',
      line: '#e6e2db', lineSoft: '#f0ece4', lineInput: '#d8d3cb',
      up: '#0f7a43', down: '#c0392b', accent: '#7a4a38', accentHover: '#5c3729',
      accentSoft: '#f4f0ec', onAccent: '#ffffff', toastBg: '#17140f', toastInk: '#ffffff',
      toastCheck: '#7fd8a4', accentShadow: 'rgba(122,74,56,.35)',
      hero: '#17140f', onHero: '#ffffff', onHeroSoft: 'rgba(255,255,255,.6)',
      heroLine: 'rgba(255,255,255,.26)', atencao: ATENCAO_CLARO,
    },
  },
  gelo: {
    rotulo: 'Gelo e teal',
    escuro: false,
    tokens: {
      canvas: '#f4f7f7', surface: '#ffffff', surfaceMuted: '#f7fbfa', segment: '#e6edec',
      ink: '#0e1a18', inkMuted: '#5c6a68', inkSoft: '#7b8785', inkFaint: '#98a3a1',
      line: '#e1e8e7', lineSoft: '#eef3f2', lineInput: '#ccd6d4',
      up: '#12925c', down: '#e0523f', accent: '#0f766e', accentHover: '#0b5b55',
      accentSoft: '#e4f1ef', onAccent: '#ffffff', toastBg: '#0e1a18', toastInk: '#ffffff',
      toastCheck: '#5eead4', accentShadow: 'rgba(15,118,110,.32)',
      hero: '#0f766e', onHero: '#ffffff', onHeroSoft: 'rgba(255,255,255,.66)',
      heroLine: 'rgba(255,255,255,.3)', atencao: ATENCAO_CLARO,
    },
  },
  meianoite: {
    rotulo: 'Meia-noite azul',
    escuro: true,
    tokens: {
      canvas: '#0a0f16', surface: '#111823', surfaceMuted: '#151d29', segment: '#1b2431',
      ink: '#eaf0f8', inkMuted: '#9aa7b8', inkSoft: '#85919f', inkFaint: '#6f7b89',
      line: '#232d3b', lineSoft: '#1d2633', lineInput: '#2d3745',
      up: '#34d399', down: '#fb7185', accent: '#7fa8ff', accentHover: '#9dbcff',
      accentSoft: '#182338', onAccent: '#0a0f16', toastBg: '#eaf0f8', toastInk: '#0a0f16',
      toastCheck: '#0f7a43', accentShadow: 'rgba(127,168,255,.28)',
      hero: '#142033', onHero: '#eaf0f8', onHeroSoft: 'rgba(234,240,248,.62)',
      heroLine: 'rgba(234,240,248,.16)', atencao: ATENCAO_ESCURO,
    },
  },
  ameixaNoite: {
    rotulo: 'Ameixa noturna',
    escuro: true,
    tokens: {
      canvas: '#0d0912', surface: '#17111f', surfaceMuted: '#1c1526', segment: '#241b30',
      ink: '#f2ecf7', inkMuted: '#a79cb3', inkSoft: '#93889f', inkFaint: '#7c7188',
      line: '#271f33', lineSoft: '#201929', lineInput: '#322942',
      up: '#34d399', down: '#fb7185', accent: '#c9a6f7', accentHover: '#dcc2ff',
      accentSoft: '#241932', onAccent: '#12091b', toastBg: '#f2ecf7', toastInk: '#12091b',
      toastCheck: '#0f7a43', accentShadow: 'rgba(201,166,247,.28)',
      hero: '#2a1740', onHero: '#f2ecf7', onHeroSoft: 'rgba(242,236,247,.62)',
      heroLine: 'rgba(242,236,247,.16)', atencao: ATENCAO_ESCURO,
    },
  },
  floresta: {
    rotulo: 'Floresta escura',
    escuro: true,
    tokens: {
      canvas: '#08110d', surface: '#0f1a15', surfaceMuted: '#13201a', segment: '#1a2a22',
      ink: '#e9f2ec', inkMuted: '#94a89d', inkSoft: '#82958b', inkFaint: '#6d8077',
      line: '#1f2f27', lineSoft: '#18261f', lineInput: '#283a31',
      up: '#4ade80', down: '#fb7185', accent: '#5eead4', accentHover: '#8bf3e2',
      accentSoft: '#122a26', onAccent: '#062018', toastBg: '#e9f2ec', toastInk: '#062018',
      toastCheck: '#0f7a43', accentShadow: 'rgba(94,234,212,.26)',
      hero: '#0f2b21', onHero: '#e9f2ec', onHeroSoft: 'rgba(233,242,236,.62)',
      heroLine: 'rgba(233,242,236,.16)', atencao: ATENCAO_ESCURO,
    },
  },
  oled: {
    rotulo: 'Preto e lima escuro',
    escuro: true,
    tokens: {
      canvas: '#000000', surface: '#0b0b0b', surfaceMuted: '#101010', segment: '#171717',
      ink: '#f4f4ef', inkMuted: '#9d9d95', inkSoft: '#8a8a82', inkFaint: '#71716a',
      line: '#1e1e1c', lineSoft: '#171716', lineInput: '#2a2a27',
      up: '#a3e635', down: '#fb7185', accent: '#d3f26b', accentHover: '#e2fa93',
      accentSoft: '#1b2010', onAccent: '#14150f', toastBg: '#d3f26b', toastInk: '#14150f',
      toastCheck: '#14150f', accentShadow: 'rgba(211,242,107,.26)',
      hero: '#d3f26b', onHero: '#14150f', onHeroSoft: 'rgba(20,21,15,.62)',
      heroLine: 'rgba(20,21,15,.18)', atencao: '#8a5c0f',
    },
  },
  grafite: {
    rotulo: 'Grafite escuro',
    escuro: true,
    tokens: {
      canvas: '#101215', surface: '#191c21', surfaceMuted: '#1e2228', segment: '#23272e',
      ink: '#f1f3f6', inkMuted: '#a6adb6', inkSoft: '#8c939d', inkFaint: '#757c86',
      line: '#272c33', lineSoft: '#22262c', lineInput: '#333942',
      up: '#34d399', down: '#fb7185', accent: '#e0a45c', accentHover: '#c78d47',
      accentSoft: '#2a2318', onAccent: '#14161a', toastBg: '#f1f3f6', toastInk: '#14161a',
      toastCheck: '#0f7a43', accentShadow: 'rgba(224,164,92,.3)',
      hero: '#191c21', onHero: '#f1f3f6', onHeroSoft: 'rgba(241,243,246,.6)',
      heroLine: 'rgba(241,243,246,.16)', atencao: ATENCAO_ESCURO,
    },
  },
};

export const paletaPadrao: PaletaId = 'ameixaNoite';

/**
 * Tons alternativos para as cores próprias das categorias em paleta escura.
 * O hex de referência é sempre o da paleta clara.
 */
const tonsEscuros: Record<string, string> = {
  '#c0562b': '#fb9a6b',
  '#2f6f8f': '#6fc3e8',
  '#b03a5b': '#f88fa8',
  '#6b4e9e': '#b39cf0',
  '#3c6e5b': '#79d8b4',
  '#8a6d3b': '#e3c07a',
  '#4a5f8a': '#93b0e8',
};

/**
 * Referência de cor: ou um token da paleta, ou um hex próprio da categoria.
 * Guardamos a referência, não a cor resolvida — assim trocar de paleta
 * repinta tudo sem tocar nos dados.
 */
export type CorRef = { tipo: 'token'; token: keyof Tokens } | { tipo: 'hex'; hex: string };

export const token = (t: keyof Tokens): CorRef => ({ tipo: 'token', token: t });
export const hex = (h: string): CorRef => ({ tipo: 'hex', hex: h });

export function resolverCor(ref: CorRef, paleta: Paleta): string {
  if (ref.tipo === 'token') return paleta.tokens[ref.token];
  const alternativo = tonsEscuros[ref.hex];
  return paleta.escuro && alternativo ? alternativo : ref.hex;
}

/**
 * Versão translúcida de uma cor — o `color-mix` do protótipo, que o RN não tem.
 * `pct` é a opacidade em porcentagem.
 */
export function comAlfa(cor: string, pct: number): string {
  const alfa = Math.max(0, Math.min(100, pct)) / 100;
  const m = /^#([0-9a-f]{6})$/i.exec(cor);
  if (m) {
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(cor);
  if (rgb) {
    const [r, g, b] = rgb[1].split(',').map((x) => parseFloat(x.trim()));
    return `rgba(${r}, ${g}, ${b}, ${alfa})`;
  }
  return cor;
}
