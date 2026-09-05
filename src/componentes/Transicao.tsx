import React from 'react';
import { Animated } from 'react-native';
import { DURACAO, useEntrada } from './animacao';

/**
 * A troca de tela, suavizada.
 *
 * Sem isto o conteúdo novo simplesmente aparece no lugar do antigo, e o corte
 * seco faz a navegação parecer um recarregamento. Um fade curto com 6px de
 * subida diz "isto é outra tela" sem custar tempo: 170ms terminam antes de a
 * pessoa acabar de tirar o dedo do botão.
 *
 * `chave` reinicia a animação a cada tela — a mesma coisa que o `key` do
 * ScrollView já faz por remontagem, mas dita aqui, para que a transição não
 * dependa de um detalhe de rolagem lá em cima.
 */
export function Transicao({ chave, children }: { chave: string; children: React.ReactNode }) {
  const entrada = useEntrada(DURACAO.tela, chave);

  return (
    <Animated.View
      style={{
        flexGrow: 1,
        opacity: entrada,
        transform: [
          { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
