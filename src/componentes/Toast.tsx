import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { icones } from '../dominio/categorias';
import { useLoja } from '../estado/store';
import { useTema } from '../tema/TemaContext';
import { Toque, Txt } from './basicos';
import { Icone } from './Icone';

/**
 * Confirmação de ação.
 *
 * Ação destrutiva ou facilmente errada usa DESFAZER aqui, não modal de
 * confirmação — modal é fricção pior. O toast carrega a própria ação, então
 * este componente só a despacha.
 */
export function Toast() {
  const { estado, despachar } = useLoja();
  const { t } = useTema();
  const toast = estado.toast;
  const entrada = useRef(new Animated.Value(0)).current;

  const id = toast?.id;
  const duracao = toast?.duracaoMs ?? 0;

  useEffect(() => {
    if (id === undefined) return;
    entrada.setValue(0);
    Animated.timing(entrada, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    const timer = setTimeout(() => despachar({ tipo: 'LIMPAR_TOAST', id }), duracao);
    return () => clearTimeout(timer);
  }, [id, duracao, despachar, entrada]);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 18,
        right: 18,
        bottom: 82,
        opacity: entrada,
        transform: [
          { translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
        ],
      }}
    >
      <View
        style={{
          backgroundColor: t.toastBg,
          borderRadius: 14,
          paddingVertical: 13,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          elevation: 6,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
        }}
      >
        <Icone path={icones.check} tamanho={17} cor={t.toastCheck} espessura={2} />
        <View style={{ flex: 1, gap: 3 }}>
          <Txt tamanho={13} peso={500} cor={t.toastInk} entrelinha={1.3}>
            {toast.texto}
          </Txt>
          {toast.sub ? (
            <Txt
              tamanho={11.5}
              peso={500}
              cor={t.toastInk}
              entrelinha={1.35}
              estilo={{ opacity: 0.62 }}
            >
              {toast.sub}
            </Txt>
          ) : null}
        </View>
        {toast.acao ? (
          <Toque
            aoTocar={() => {
              despachar({ tipo: 'LIMPAR_TOAST', id: toast.id });
              despachar(toast.acao!.acao);
            }}
            rotuloAcessivel={toast.acao.rotulo}
          >
            <Txt tamanho={12} peso={600} cor={t.toastCheck}>
              {toast.acao.rotulo}
            </Txt>
          </Toque>
        ) : null}
      </View>
    </Animated.View>
  );
}
