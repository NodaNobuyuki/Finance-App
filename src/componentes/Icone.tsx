import React from 'react';
import Svg, { Path } from 'react-native-svg';

/**
 * Ícone de traçado 24×24. Todos os desenhos do app são paths — nenhum asset
 * de imagem, para que a cor venha sempre do tema.
 */
export function Icone({
  path,
  tamanho = 18,
  cor,
  espessura = 1.6,
}: {
  path: string;
  tamanho?: number;
  cor: string;
  espessura?: number;
}) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none">
      <Path
        d={path}
        stroke={cor}
        strokeWidth={espessura}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
