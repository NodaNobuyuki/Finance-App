import { TextStyle } from 'react-native';

/**
 * Tipografia do Poupa.
 *
 * No React Native cada peso é uma família própria — não existe `font-weight`
 * variável como no CSS do protótipo. Estas funções escondem isso: a tela pede
 * `sans(600)` e recebe a família certa.
 *
 * Valores monetários usam sempre a família mono, para que os dígitos fiquem
 * alinhados entre linhas.
 */

export type Peso = 400 | 500 | 600 | 700;

const SANS: Record<Peso, string> = {
  400: 'IBMPlexSans_400Regular',
  500: 'IBMPlexSans_500Medium',
  600: 'IBMPlexSans_600SemiBold',
  700: 'IBMPlexSans_700Bold',
};

const MONO: Record<Peso, string> = {
  400: 'IBMPlexMono_400Regular',
  500: 'IBMPlexMono_500Medium',
  600: 'IBMPlexMono_600SemiBold',
  700: 'IBMPlexMono_600SemiBold',
};

export function sans(peso: Peso = 400): TextStyle {
  return { fontFamily: SANS[peso] };
}

/** Família mono — para dinheiro, percentuais e teclado numérico. */
export function mono(peso: Peso = 600): TextStyle {
  return { fontFamily: MONO[peso] };
}
