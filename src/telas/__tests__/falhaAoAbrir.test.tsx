import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { TemaProvider } from '../../tema/TemaContext';
import { FaixaSemSalvar, FalhaAoAbrir } from '../FalhaAoAbrir';

/**
 * A tela que aparece quando o banco não abre. Fica fora da `LojaProvider` —
 * sem dados não há loja —, e é isso que o teste também monta: se ela passar a
 * depender da loja, quebra aqui antes de quebrar no aparelho.
 */
describe('FalhaAoAbrir', () => {
  it('monta só com o tema e oferece as duas saídas', async () => {
    const aoTentar = jest.fn();
    const aoUsarSemSalvar = jest.fn();
    const tela = await render(
      <TemaProvider>
        <FalhaAoAbrir aoTentar={aoTentar} aoUsarSemSalvar={aoUsarSemSalvar} />
      </TemaProvider>,
    );

    // Quem já usa o app precisa ler que nada foi perdido.
    expect(tela.getByText(/Nada foi apagado/)).toBeTruthy();

    await fireEvent.press(tela.getByLabelText('Tentar de novo'));
    expect(aoTentar).toHaveBeenCalledTimes(1);

    await fireEvent.press(tela.getByLabelText('Usar sem salvar'));
    expect(aoUsarSemSalvar).toHaveBeenCalledTimes(1);
  });

  it('a faixa do modo sem salvar diz o que custa', async () => {
    const tela = await render(
      <TemaProvider>
        <FaixaSemSalvar />
      </TemaProvider>,
    );
    expect(tela.getByText(/some ao fechar o app/)).toBeTruthy();
  });
});
