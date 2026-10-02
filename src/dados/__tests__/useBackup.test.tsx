import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { ArquivoFalhou } from '../../dominio/erros';
import { estadoInicial, estadoVazio, LojaProvider, useSeletor, Estado } from '../../estado/store';
import { compartilharBackup, escolherBackup } from '../arquivoBackup';
import { gerarBackup, lerBackup } from '../backup';
import { recortePersistido } from '../persistido';
import { useBackup } from '../useBackup';

// A ponta nativa não roda no Jest; o que se testa aqui é a cola entre ela,
// o formato e a loja — o que vira ação, o que vira toast.
jest.mock('../arquivoBackup', () => ({
  compartilharBackup: jest.fn(),
  escolherBackup: jest.fn(),
}));
const compartilhar = jest.mocked(compartilharBackup);
const escolher = jest.mocked(escolherBackup);

async function montar(inicial: Estado) {
  return renderHook(
    () => ({
      backup: useBackup(),
      toast: useSeletor((e) => e.toast),
      transacoes: useSeletor((e) => e.transacoes),
      onboardingConcluido: useSeletor((e) => e.onboardingConcluido),
    }),
    { wrapper: ({ children }) => <LojaProvider inicial={inicial}>{children}</LojaProvider> },
  );
}

beforeEach(() => jest.resetAllMocks());

describe('exportar', () => {
  it('entrega o estado inteiro, num arquivo com a data no nome', async () => {
    const { result } = await montar(estadoInicial);
    await act(() => result.current.backup.exportar());

    const [conteudo, nome] = compartilhar.mock.calls[0];
    expect(nome).toBe(`poupa-bloco-${estadoInicial.hoje}.json`);
    expect(lerBackup(conteudo)).toEqual(recortePersistido(estadoInicial));
  });

  it('falha vira recado, sem detalhe técnico', async () => {
    compartilhar.mockRejectedValue(new ArquivoFalhou('exportar', new Error('ENOSPC')));
    const { result } = await montar(estadoInicial);
    await act(() => result.current.backup.exportar());

    expect(result.current.toast!.texto).toBe('Não deu para gerar o backup. Tente de novo.');
  });
});

describe('restaurar', () => {
  it('backup válido do primeiro uso entra direto no app', async () => {
    escolher.mockResolvedValue(gerarBackup(recortePersistido(estadoInicial), 0));
    const { result } = await montar(estadoVazio);
    await act(() => result.current.backup.restaurar());

    expect(result.current.onboardingConcluido).toBe(true);
    expect(result.current.transacoes).toHaveLength(estadoInicial.transacoes.length);
  });

  it('desistir no seletor não mexe em nada', async () => {
    escolher.mockResolvedValue(null);
    const { result } = await montar(estadoInicial);
    const antes = result.current.transacoes;
    await act(() => result.current.backup.restaurar());

    expect(result.current.transacoes).toBe(antes);
    expect(result.current.toast).toBeNull();
  });

  it('arquivo que não é backup vira recado e não mexe em nada', async () => {
    escolher.mockResolvedValue('{"qualquer": "coisa"}');
    const { result } = await montar(estadoInicial);
    const antes = result.current.transacoes;
    await act(() => result.current.backup.restaurar());

    expect(result.current.transacoes).toBe(antes);
    expect(result.current.toast!.texto).toBe('Este arquivo não é um backup do Poupa Bloco.');
  });

  it('arquivo que não abre vira recado', async () => {
    escolher.mockRejectedValue(new ArquivoFalhou('abrir'));
    const { result } = await montar(estadoInicial);
    await act(() => result.current.backup.restaurar());

    expect(result.current.toast!.texto).toBe('Não deu para abrir o arquivo. Tente de novo.');
  });
});
