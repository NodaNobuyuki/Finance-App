import { useCallback } from 'react';
import { escolherArquivo } from '../dados/arquivos';
import { mensagemParaOUsuario } from '../dominio/erros';
import { useDespachar } from '../estado/store';
import { adapterOFX } from './adapters/ofx';
import { decodificar } from './texto';

/**
 * Escolher um OFX e abrir a prévia.
 *
 * Arquivo, decodificação e adapter ficam aqui, fora do reducer — só o extrato
 * já lido entra como ação. Nada é gravado neste passo: a prévia é que decide.
 */
export function useImportarExtrato(): () => Promise<void> {
  const despachar = useDespachar();

  return useCallback(async () => {
    try {
      const bytes = await escolherArquivo();
      if (bytes === null) return;
      const extrato = adapterOFX.ler(decodificar(bytes));
      if (extrato.transacoes.length === 0) {
        despachar({
          tipo: 'AVISAR',
          texto: 'Nenhum lançamento neste extrato',
          sub:
            extrato.ignoradas > 0
              ? `${extrato.ignoradas} linhas não puderam ser lidas.`
              : 'O período exportado está vazio.',
        });
        return;
      }
      despachar({ tipo: 'ABRIR_IMPORTACAO', extrato });
    } catch (erro) {
      despachar({ tipo: 'AVISAR', texto: mensagemParaOUsuario(erro) });
    }
  }, [despachar]);
}
