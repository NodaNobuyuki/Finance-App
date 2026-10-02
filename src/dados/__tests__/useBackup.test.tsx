import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { ArquivoFalhou } from '../../dominio/erros';
import { estadoInicial, estadoVazio, LojaProvider, useSeletor, Estado } from '../../estado/store';
import { compartilharArquivo, escolherArquivo } from '../arquivos';
import { gerarBackup, lerBackup } from '../backup';
import { recortePersistido } from '../persistido';
import { useBackup } from '../useBackup';

// A ponta nativa não roda no Jest; o que se testa aqui é a cola entre ela,
// o formato e a loja — o que vira ação, o que vira toast.
jest.mock('../arquivos', () => ({
  compartilharArquivo: jest.fn(),
  escolherArquivo: jest.fn(),
}));
const compartilhar = jest.mocked(compartilharArquivo);
const escolher = jest.mocked(escolherArquivo);
const bytes = (texto: string) => new TextEncoder().encode(texto);

async function montar(inicial: Estado) {
  return renderHook(
    () => ({
      backup: useBackup(),
      toast: useSeletor((e) => e.toast),
      transacoes: useSeletor((e) => e.transacoes),
      onboardingConcluido: useSeletor((e) => e.onboardingConcluido),
      ultimoBackupEm: useSeletor((e) => e.ultimoBackupEm),
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
    expect(lerBackup(conteudo)).toEqual({
      ...recortePersistido(estadoInicial),
      ultimoBackupEm: expect.any(Number),
    });
  });

  it('marca o último backup com o mesmo instante gravado no arquivo', async () => {
    const { result } = await montar(estadoInicial);
    expect(result.current.ultimoBackupEm).toBeNull();
    await act(() => result.current.backup.exportar());

    const [conteudo] = compartilhar.mock.calls[0];
    expect(result.current.ultimoBackupEm).toBe(lerBackup(conteudo).ultimoBackupEm);
  });

  it('falha vira recado, sem detalhe técnico — e não conta como backup', async () => {
    compartilhar.mockRejectedValue(new ArquivoFalhou('exportar', new Error('ENOSPC')));
    const { result } = await montar(estadoInicial);
    await act(() => result.current.backup.exportar());

    expect(result.current.toast!.texto).toBe('Não deu para gerar o backup. Tente de novo.');
    expect(result.current.ultimoBackupEm).toBeNull();
  });
});

describe('restaurar', () => {
  it('backup válido do primeiro uso entra direto no app', async () => {
    escolher.mockResolvedValue(bytes(gerarBackup(recortePersistido(estadoInicial), 0)));
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
    escolher.mockResolvedValue(bytes('{"qualquer": "coisa"}'));
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
