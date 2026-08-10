/**
 * Identificadores de entidade.
 *
 * `tx-1`, `ap-2` eram determinísticos para teste e colidem no mundo real: dois
 * aparelhos do mesmo usuário — ou uma reinstalação — geram a mesma sequência e
 * o sync passa a sobrescrever registro alheio. Como id de linha gravada não se
 * troca depois sem migração de dado vivo, isto entra antes da persistência.
 *
 * UUID v7 carrega o instante de criação nos 48 bits mais altos, então ordena
 * lexicograficamente por tempo — índice de banco não fragmenta como no v4.
 */

export type GerarId = () => string;

/**
 * Bytes aleatórios do melhor gerador disponível.
 *
 * O runtime do Expo Go em SDK 54 não garante `crypto.getRandomValues` — não há
 * polyfill de WebCrypto no bundle. O fallback é `Math.random`: fraco para
 * criptografia, suficiente aqui, porque os 48 bits de timestamp já separam
 * quase toda colisão possível dentro do histórico de um único usuário.
 *
 * Se um dia isto precisar ser forte, o lugar de trocar é esta função —
 * `expo-crypto` expõe `getRandomBytes` e nada mais no app muda.
 */
function bytesAleatorios(tamanho: number): Uint8Array {
  const bytes = new Uint8Array(tamanho);
  const cripto = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } }).crypto;
  if (cripto?.getRandomValues) {
    cripto.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < tamanho; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

/** UUID v7 conforme RFC 9562: 48 bits de epoch em ms + 74 bits aleatórios. */
export function uuidV7(agoraMs: number = Date.now()): string {
  const b = bytesAleatorios(16);

  b[0] = (agoraMs / 2 ** 40) & 0xff;
  b[1] = (agoraMs / 2 ** 32) & 0xff;
  b[2] = (agoraMs / 2 ** 24) & 0xff;
  b[3] = (agoraMs / 2 ** 16) & 0xff;
  b[4] = (agoraMs / 2 ** 8) & 0xff;
  b[5] = agoraMs & 0xff;

  b[6] = (b[6] & 0x0f) | 0x70; // versão 7
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC

  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/**
 * Gerador sequencial, para teste. Mesma sequência de ações, mesmos ids —
 * é o que mantém as asserções legíveis sem congelar o relógio.
 */
export function idsSequenciais(prefixo = 'id'): GerarId {
  let n = 0;
  return () => {
    n += 1;
    return `${prefixo}-${n}`;
  };
}
