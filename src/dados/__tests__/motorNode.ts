import { DatabaseSync } from 'node:sqlite';
import { MotorSQL, Parametro } from '../motor';

/**
 * `MotorSQL` sobre o SQLite embutido do Node — só para teste.
 *
 * Não é um mock: é SQLite de verdade, o mesmo motor que roda no aparelho. O
 * que a suíte exercita são as migrations e o SQL reais, então erro de esquema
 * aparece aqui e não no celular de quem instalou o app.
 *
 * A API do `node:sqlite` é síncrona; envolver em `async` mantém o contrato
 * sem mudar semântica — `await` sobre valor pronto resolve na microtask.
 */
export function criarMotorNode(): MotorSQL {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');

  return {
    async executar(sql: string, parametros: Parametro[] = []) {
      db.prepare(sql).run(...parametros);
    },

    async consultar<L>(sql: string, parametros: Parametro[] = []) {
      return db.prepare(sql).all(...parametros) as L[];
    },

    async emTransacao<T>(corpo: () => Promise<T>) {
      db.exec('BEGIN');
      try {
        const resultado = await corpo();
        db.exec('COMMIT');
        return resultado;
      } catch (erro) {
        db.exec('ROLLBACK');
        throw erro;
      }
    },

    async fechar() {
      db.close();
    },
  };
}
