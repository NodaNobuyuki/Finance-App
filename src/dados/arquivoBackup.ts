import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ArquivoFalhou } from '../dominio/erros';

/**
 * A ponta nativa do backup: gravar o arquivo e entregá-lo à folha de
 * compartilhar, e abrir um que a pessoa escolher.
 *
 * Repasse puro, como `motorExpo.ts` — nada aqui decide coisa alguma. Gerar e
 * validar o conteúdo é `backup.ts`, que roda no Jest; isto não roda, e por
 * isso não pode ter regra.
 */

export async function compartilharBackup(conteudo: string, nome: string): Promise<void> {
  try {
    if (!(await Sharing.isAvailableAsync())) throw new Error('compartilhar indisponível');
    // No cache: o arquivo só precisa existir até a folha de compartilhar
    // copiá-lo para onde a pessoa escolher (Arquivos, iCloud, e-mail).
    const arquivo = new File(Paths.cache, nome);
    if (arquivo.exists) arquivo.delete();
    arquivo.create();
    arquivo.write(conteudo);
    await Sharing.shareAsync(arquivo.uri, {
      mimeType: 'application/json',
      UTI: 'public.json',
      dialogTitle: 'Salvar backup',
    });
  } catch (erro) {
    throw new ArquivoFalhou('exportar', erro);
  }
}

/** O texto do arquivo escolhido, ou `null` se a pessoa desistiu no seletor. */
export async function escolherBackup(): Promise<string | null> {
  try {
    // Qualquer tipo: arquivo salvo por outro app pode perder a extensão, e o
    // que decide se é backup é o conteúdo, validado em `lerBackup`.
    const escolha = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (escolha.canceled) return null;
    return await new File(escolha.assets[0].uri).text();
  } catch (erro) {
    throw new ArquivoFalhou('abrir', erro);
  }
}
