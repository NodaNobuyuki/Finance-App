import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Toque, Txt } from '../../componentes/basicos';
import { Icone } from '../../componentes/Icone';
import { icones } from '../../dominio/categorias';
import { useTema } from '../../tema/TemaContext';

/**
 * Painel que cobre a tela inteira (nova transação, aporte, ritual).
 * Sobe da base como no protótipo — feedback imediato de que algo abriu.
 */
export function Folha({
  titulo,
  aoFechar,
  children,
  cabecalho,
}: {
  titulo?: string;
  aoFechar?: () => void;
  children: React.ReactNode;
  /** Substitui a barra padrão quando a folha tem cabeçalho próprio. */
  cabecalho?: React.ReactNode;
}) {
  const { t } = useTema();
  const entrada = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrada, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [entrada]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.canvas,
        opacity: entrada,
        transform: [
          { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
        ],
      }}
    >
      {cabecalho ?? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 10,
          }}
        >
          <Toque aoTocar={aoFechar} rotuloAcessivel="Fechar">
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                backgroundColor: t.segment,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icone path={icones.fechar} tamanho={17} cor={t.ink} espessura={2} />
            </View>
          </Toque>
          <Txt tamanho={15} peso={600}>
            {titulo}
          </Txt>
          <View style={{ width: 34 }} />
        </View>
      )}
      {children}
    </Animated.View>
  );
}
