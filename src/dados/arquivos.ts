import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ArquivoFalhou } from '../dominio/erros';

/**
 * A ponta nativa dos arquivos: gravar um e entregá-lo à folha de compartilhar,
 * e abrir o que a pessoa escolher — backup ou extrato de banco.
 *
 * Repasse puro, como `motorExpo.ts` — nada aqui decide coisa alguma. Gerar,
 * decodificar e validar o conteúdo é de `backup.ts` e de `ingestao/`, que
 * rodam no Jest; isto não roda, e por isso não pode ter regra.
 */

export async function compartilharArquivo(conteudo: string, nome: string): Promise<void> {
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

/**
 * Os BYTES do arquivo escolhido, ou `null` se a pessoa desistiu no seletor.
 *
 * Bytes e não texto: extrato de banco chega em cp1252 ou UTF-8 e o cabeçalho
 * mente sobre qual — quem decide é `decodificar()`, olhando o conteúdo.
 */
export async function escolherArquivo(): Promise<Uint8Array | null> {
  try {
    // Qualquer tipo: arquivo salvo por outro app pode perder a extensão, e o
    // que decide se serve é o conteúdo, validado depois.
    const escolha = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (escolha.canceled) return null;
    return await new File(escolha.assets[0].uri).bytes();
  } catch (erro) {
    throw new ArquivoFalhou('abrir', erro);
  }
}
