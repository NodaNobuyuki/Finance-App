import React from 'react';
import { View } from 'react-native';
import { useTema } from '../tema/TemaContext';
import { Toque, Txt } from './basicos';

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0'] as const;

/**
 * Teclado numérico próprio.
 *
 * O teclado do sistema não serve aqui: digitar dinheiro é preencher centavos
 * da direita para a esquerda, sem separador nem ponto decimal. Também mantém
 * o lançamento a um toque de distância, sem rede no caminho.
 */
export function Teclado({
  aoDigitar,
  aoApagar,
  altura = 46,
}: {
  aoDigitar: (digito: string) => void;
  aoApagar: () => void;
  altura?: number;
}) {
  const { t } = useTema();

  const tecla = (rotulo: string, aoTocar: () => void) => (
    <View key={rotulo} style={{ width: '31.5%' }}>
      <Toque aoTocar={aoTocar} rotuloAcessivel={rotulo === '⌫' ? 'Apagar' : rotulo}>
        <View
          style={{
            height: altura,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.surfaceMuted,
            borderWidth: 1,
            borderColor: t.lineSoft,
          }}
        >
          <Txt tamanho={19} peso={600} numerico cor={t.ink}>
            {rotulo}
          </Txt>
        </View>
      </Toque>
    </View>
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 7,
      }}
    >
      {TECLAS.map((k) => tecla(k, () => aoDigitar(k)))}
      {tecla('⌫', aoApagar)}
    </View>
  );
}
