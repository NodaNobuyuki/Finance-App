import React from 'react';
import { View } from 'react-native';
import { comAlfa } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';
import { Icone } from './Icone';
import { Toque, Txt } from './basicos';

/**
 * Estado vazio.
 *
 * Regra de UX do projeto: empty state nunca é texto seco. Aqui é sempre marca
 * visual + frase que explica + convite para a ação que resolve — porque tela
 * vazia é justamente onde a pessoa decide se o app serve para ela.
 */
export function Vazio({
  icone,
  titulo,
  texto,
  acao,
  compacto = false,
}: {
  /** Path SVG 24×24, do vocabulário de `icones`. */
  icone: string;
  titulo: string;
  texto: string;
  acao?: { rotulo: string; aoTocar: () => void };
  /** Versão curta, para vazio dentro de uma seção em vez de tela inteira. */
  compacto?: boolean;
}) {
  const { t } = useTema();

  return (
    <View
      style={{
        alignItems: 'center',
        gap: compacto ? 10 : 14,
        paddingVertical: compacto ? 24 : 40,
        paddingHorizontal: 20,
      }}
    >
      <View
        style={{
          width: compacto ? 48 : 62,
          height: compacto ? 48 : 62,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: comAlfa(t.accent, 12),
        }}
      >
        <Icone
          path={icone}
          tamanho={compacto ? 22 : 28}
          cor={t.accent}
          espessura={compacto ? 1.6 : 1.5}
        />
      </View>

      <View style={{ gap: 5, alignItems: 'center' }}>
        <Txt tamanho={compacto ? 13.5 : 15} peso={600} alinhamento="center">
          {titulo}
        </Txt>
        <Txt
          tamanho={compacto ? 12 : 12.5}
          cor={t.inkSoft}
          alinhamento="center"
          entrelinha={1.5}
          estilo={{ maxWidth: 280 }}
        >
          {texto}
        </Txt>
      </View>

      {acao ? (
        <Toque aoTocar={acao.aoTocar} rotuloAcessivel={acao.rotulo}>
          <View
            style={{
              borderRadius: 999,
              paddingVertical: 10,
              paddingHorizontal: 18,
              backgroundColor: t.accent,
            }}
          >
            <Txt tamanho={13} peso={600} cor={t.onAccent}>
              {acao.rotulo}
            </Txt>
          </View>
        </Toque>
      ) : null}
    </View>
  );
}
