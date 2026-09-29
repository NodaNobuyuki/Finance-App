/**
 * O driver SQL, atrás de uma interface.
 *
 * Existe por um motivo prático: `expo-sqlite` é módulo nativo e não roda no
 * Jest. Sem este seam, migrations e SQL só seriam exercitados no aparelho — ou
 * seja, nunca, até corromperem dado de alguém. Com ele, a MESMA suíte roda
 * contra o SQLite embutido do Node (`node:sqlite`), então o que é testado é o
 * SQL de verdade, não uma imitação.
 *
 * O que sobra sem cobertura é só a ligação com o `expo-sqlite` — algumas linhas
 * em `motorExpo.ts`, e nada de lógica.
 *
 * Assíncrono de propósito: disco é I/O, e o caminho crítico de lançamento não
 * pode ficar esperando por ele.
 */

export type Parametro = string | number | null;

export interface MotorSQL {
  /** Comando sem retorno: DDL, INSERT, UPDATE, DELETE. */
  executar(sql: string, parametros?: Parametro[]): Promise<void>;

  /** Consulta que devolve linhas. */
  consultar<L>(sql: string, parametros?: Parametro[]): Promise<L[]>;

  /**
   * Roda `corpo` numa transação. Qualquer exceção desfaz tudo.
   *
   * É o que garante que meia escrita nunca fica no disco: um lote de 30
   * lançamentos entra inteiro ou não entra.
   */
  emTransacao<T>(corpo: () => Promise<T>): Promise<T>;

  fechar(): Promise<void>;
}

/**
 * A escrita bateu numa restrição do esquema — UNIQUE, NOT NULL, CHECK.
 *
 * É a falha que repetir não conserta: a mesma linha bate na mesma restrição
 * toda vez. Distinguir isto de disco cheio é o que impede uma linha ruim de
 * travar todas as gravações seguintes.
 *
 * Reconhecida pela mensagem porque quem escreve o texto é o próprio SQLite
 * ("UNIQUE constraint failed: …"), igual no aparelho e no Node — já o objeto
 * de erro, cada driver embrulha do seu jeito. Nem `instanceof Error` é
 * confiável: o erro do módulo nativo pode vir de outro realm (é o que acontece
 * com o `node:sqlite` dentro do Jest), então só a mensagem é lida.
 */
export function ehRecusaDeRestricao(erro: unknown): boolean {
  const mensagem = (erro as { message?: unknown } | null)?.message;
  return typeof mensagem === 'string' && /constraint failed/i.test(mensagem);
}
