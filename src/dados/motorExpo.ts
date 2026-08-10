import * as SQLite from 'expo-sqlite';
import { BancoIndisponivel } from '../dominio/erros';
import { MotorSQL, Parametro } from './motor';

/**
 * Ligação com o `expo-sqlite`.
 *
 * É o único arquivo do projeto que o Jest não alcança — módulo nativo. Por
 * isso ele não decide nada: sem SQL próprio, sem regra, só repasse. Toda a
 * lógica que poderia errar mora em `migracoes.ts` e `repositorioSQL.ts`, que
 * rodam contra SQLite de verdade na suíte.
 */

export const NOME_DO_BANCO = 'poupa-bloco.db';

export async function abrirMotorExpo(nome: string = NOME_DO_BANCO): Promise<MotorSQL> {
  let db: SQLite.SQLiteDatabase;
  try {
    db = await SQLite.openDatabaseAsync(nome);
    // Integridade referencial ligada explicitamente: o SQLite vem com as
    // foreign keys DESLIGADAS por padrão, por compatibilidade histórica.
    await db.execAsync('PRAGMA foreign_keys = ON');
    // WAL: leitura não bloqueia escrita. Sem isso, abrir o Extrato durante uma
    // gravação pode travar a interface.
    await db.execAsync('PRAGMA journal_mode = WAL');
  } catch (causa) {
    throw new BancoIndisponivel(causa);
  }

  return {
    async executar(sql, parametros = []) {
      await db.runAsync(sql, parametros as SQLite.SQLiteBindValue[]);
    },

    async consultar<L>(sql: string, parametros: Parametro[] = []) {
      return db.getAllAsync<L>(sql, parametros as SQLite.SQLiteBindValue[]);
    },

    async emTransacao<T>(corpo: () => Promise<T>) {
      let resultado!: T;
      await db.withTransactionAsync(async () => {
        resultado = await corpo();
      });
      return resultado;
    },

    async fechar() {
      await db.closeAsync();
    },
  };
}
