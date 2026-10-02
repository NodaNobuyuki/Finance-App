import { act, renderHook } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { escolherArquivo } from '../../dados/arquivos';
import { ArquivoFalhou } from '../../dominio/erros';
import { Estado, estadoInicial, LojaProvider, useSeletor } from '../../estado/store';
import { useImportarExtrato } from '../useImportarExtrato';

// A ponta nativa não roda no Jest; o que se testa é o caminho dos bytes até a
// prévia — encoding, adapter e o que vira recado.
jest.mock('../../dados/arquivos', () => ({ escolherArquivo: jest.fn() }));
const escolher = jest.mocked(escolherArquivo);
const fixture = (nome: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures', nome)));

async function montar(inicial: Estado = estadoInicial) {
  return renderHook(
    () => ({
      importar: useImportarExtrato(),
      folha: useSeletor((e) => e.folha),
      importacao: useSeletor((e) => e.importacao),
      toast: useSeletor((e) => e.toast),
    }),
    { wrapper: ({ children }) => <LojaProvider inicial={inicial}>{children}</LojaProvider> },
  );
}

beforeEach(() => jest.resetAllMocks());

it('OFX em cp1252 abre a prévia, já na conta sugerida', async () => {
  escolher.mockResolvedValue(fixture('sgml-cp1252-sem-fechamento.ofx'));
  const { result } = await montar();
  await act(() => result.current.importar());

  expect(result.current.folha).toEqual({ tipo: 'importacao' });
  expect(result.current.importacao!.contaId).toBe('corrente');
  expect(result.current.importacao!.extrato.transacoes[0].descricaoOriginal).toMatch(
    /^Transferência/,
  );
});

it('desistir no seletor não abre nada', async () => {
  escolher.mockResolvedValue(null);
  const { result } = await montar();
  await act(() => result.current.importar());
  expect(result.current.folha).toBeNull();
  expect(result.current.toast).toBeNull();
});

it('arquivo que não é OFX vira recado', async () => {
  escolher.mockResolvedValue(new TextEncoder().encode('data;valor\n2026-08-01;-10'));
  const { result } = await montar();
  await act(() => result.current.importar());
  expect(result.current.folha).toBeNull();
  expect(result.current.toast!.texto).toBe('Este arquivo não é um extrato OFX.');
});

it('extrato sem lançamento nenhum vira recado, não prévia vazia', async () => {
  const texto = new TextDecoder().decode(fixture('nubank-conta.ofx'));
  const vazio = texto.replace(/<STMTTRN>[\s\S]*<\/STMTTRN>/, '');
  escolher.mockResolvedValue(new TextEncoder().encode(vazio));
  const { result } = await montar();
  await act(() => result.current.importar());
  expect(result.current.folha).toBeNull();
  expect(result.current.toast!.texto).toBe('Nenhum lançamento neste extrato');
});

it('arquivo que não abre vira recado', async () => {
  escolher.mockRejectedValue(new ArquivoFalhou('abrir'));
  const { result } = await montar();
  await act(() => result.current.importar());
  expect(result.current.toast!.texto).toBe('Não deu para abrir o arquivo. Tente de novo.');
});
