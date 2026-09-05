import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

/**
 * Vocabulário de movimento do app, num lugar só.
 *
 * Tudo que entra na tela usa a mesma gramática — surge com uma leve subida — e
 * só a duração muda: quanto mais a coisa cobre, mais devagar ela chega.
 * Números soltos por componente fariam a interface parecer montada por gente
 * diferente.
 */
export const DURACAO = {
  /** Troca de tela. A mais curta: acontece o tempo todo e não pode atrasar o toque. */
  tela: 170,
  /** Toast: rápido, porque ele é confirmação e some sozinho. */
  toast: 220,
  /** Folha: cobre a tela inteira, então pode anunciar-se um pouco mais. */
  folha: 240,
} as const;

/**
 * `true` quando a pessoa pediu menos movimento no sistema.
 *
 * "Reduzir movimento" é acessibilidade, não preferência estética: animação de
 * entrada dispara enjoo em quem tem sensibilidade vestibular. Começa em
 * `false` e corrige na primeira resposta do sistema — assumir o contrário
 * tiraria a animação de todo mundo no primeiro frame.
 */
export function useMenosMovimento(): boolean {
  const [reduzir, setReduzir] = useState(false);

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled().then((valor) => {
      if (vivo) setReduzir(valor);
    });
    const inscricao = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzir);
    return () => {
      vivo = false;
      inscricao.remove();
    };
  }, []);

  return reduzir;
}

/**
 * Valor de 0 a 1 que corre uma vez na montagem — o "apareceu".
 *
 * `useState` com inicializador, não `useRef().current`: o `Animated.Value` é
 * criado uma vez só e lê-lo no render é legítimo, que é o que a regra
 * `react-hooks/refs` cobra.
 *
 * Com `reiniciarEm`, a animação recomeça sempre que a chave muda — é como o
 * toast reanuncia cada recado sem remontar o componente.
 *
 * Quem pediu menos movimento recebe o valor já em 1: o conteúdo aparece
 * inteiro, no lugar certo, sem transição nenhuma.
 */
export function useEntrada(duracaoMs: number, reiniciarEm?: string | number): Animated.Value {
  const [entrada] = useState(() => new Animated.Value(0));
  const menosMovimento = useMenosMovimento();

  useEffect(() => {
    if (menosMovimento) {
      entrada.setValue(1);
      return;
    }
    entrada.setValue(0);
    const animacao = Animated.timing(entrada, {
      toValue: 1,
      duration: duracaoMs,
      useNativeDriver: true,
    });
    animacao.start();
    // Sair no meio da animação deixaria o valor parado onde estava, e o
    // componente reapareceria meio transparente na próxima montagem.
    return () => animacao.stop();
  }, [entrada, duracaoMs, reiniciarEm, menosMovimento]);

  return entrada;
}
