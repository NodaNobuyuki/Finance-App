import { render } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import { Transicao } from '../Transicao';

/**
 * O que dá para travar aqui, e o que não dá.
 *
 * `useNativeDriver: true` tira o valor do lado JS, então o `style` renderizado
 * fica congelado no estado inicial durante o teste inteiro: a animação não é
 * observável daqui — nem a real, nem o atalho de quem pediu menos movimento.
 * Teste que afirmasse "chegou a opacity 1" seria fachada.
 *
 * Sobra o que de fato pode quebrar em silêncio: o embrulho comendo o conteúdo,
 * ou a troca de tela deixando de renderizar a tela nova. Tela invisível por
 * animação travada só se pega no aparelho — ver CLAUDE.md.
 */
describe('transição de tela', () => {
  it('não engole o conteúdo que embrulha', async () => {
    const tela = await render(
      <Transicao chave="home">
        <Text>conteúdo da tela</Text>
      </Transicao>,
    );
    expect(tela.getByText('conteúdo da tela')).toBeTruthy();
  });

  it('troca o conteúdo quando a tela muda', async () => {
    const tela = await render(
      <Transicao chave="home">
        <Text>Início</Text>
      </Transicao>,
    );
    await tela.rerender(
      <Transicao chave="extrato">
        <Text>Extrato</Text>
      </Transicao>,
    );

    expect(tela.getByText('Extrato')).toBeTruthy();
    expect(tela.queryByText('Início')).toBeNull();
  });

  it('parte de invisível e deslocado — é isso que a animação desfaz', async () => {
    const tela = await render(
      <Transicao chave="home">
        <View testID="conteudo">
          <Text>oi</Text>
        </View>
      </Transicao>,
    );
    const estilo = tela.getByTestId('conteudo').parent?.props?.style;

    expect(estilo.opacity).toBe(0);
    expect(estilo.transform).toEqual([{ translateY: 6 }]);
    // `flexGrow` importa: sem ele o embrulho não herda a altura do ScrollView
    // e telas curtas param de esticar até o rodapé.
    expect(estilo.flexGrow).toBe(1);
  });

  it('pergunta ao sistema se a pessoa pediu menos movimento', async () => {
    // Animação de entrada dispara enjoo em quem tem sensibilidade vestibular.
    // Não dá para ver o efeito daqui, mas dá para travar que a pergunta é feita
    // — apagá-la seria o jeito silencioso de perder o ajuste.
    const espia = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled');
    await render(
      <Transicao chave="home">
        <Text>oi</Text>
      </Transicao>,
    );
    expect(espia).toHaveBeenCalled();
    espia.mockRestore();
  });
});
