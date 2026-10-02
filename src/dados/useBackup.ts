import { useCallback } from 'react';
import { mensagemParaOUsuario } from '../dominio/erros';
import { useDespachar, useLerEstado } from '../estado/store';
import { decodificar } from '../ingestao/texto';
import { compartilharArquivo, escolherArquivo } from './arquivos';
import { gerarBackup, lerBackup, nomeDoBackup } from './backup';
import { recortePersistido } from './persistido';

/**
 * Exportar e restaurar, ligados à loja.
 *
 * O relógio de `geradoEm` e o arquivo ficam aqui, fora do reducer: só o
 * resultado — o backup já validado — entra como ação. Falha vira toast, com a
 * frase de `mensagemParaOUsuario`; nada técnico chega à tela.
 */
export function useBackup(): { exportar: () => Promise<void>; restaurar: () => Promise<void> } {
  const lerEstado = useLerEstado();
  const despachar = useDespachar();

  const exportar = useCallback(async () => {
    const e = lerEstado();
    try {
      await compartilharArquivo(
        gerarBackup(recortePersistido(e), Date.now()),
        nomeDoBackup(e.hoje),
      );
    } catch (erro) {
      despachar({ tipo: 'AVISAR', texto: mensagemParaOUsuario(erro) });
    }
  }, [lerEstado, despachar]);

  const restaurar = useCallback(async () => {
    try {
      const bytes = await escolherArquivo();
      if (bytes === null) return;
      despachar({ tipo: 'IMPORTAR_BACKUP', dados: lerBackup(decodificar(bytes)) });
    } catch (erro) {
      despachar({ tipo: 'AVISAR', texto: mensagemParaOUsuario(erro) });
    }
  }, [despachar]);

  return { exportar, restaurar };
}
