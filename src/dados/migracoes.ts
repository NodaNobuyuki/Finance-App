import { MigracaoFalhou } from '../dominio/erros';
import { MotorSQL } from './motor';

/**
 * Migrations versionadas, desde a v1.
 *
 * A regra é única e não tem exceção: **migration já publicada nunca é
 * editada.** Mudou o esquema? Entra uma versão nova no fim da lista. Editar a
 * v1 depois que alguém instalou o app significa que o banco daquela pessoa
 * ficou com o esquema antigo e `user_version = 1`, então nada mais roda em
 * cima — e o app passa a ler colunas que não existem.
 *
 * O controle é o `PRAGMA user_version` do próprio SQLite: um inteiro que vive
 * dentro do arquivo do banco, não numa tabela nossa que também precisaria ser
 * criada por uma migration.
 *
 * Dinheiro é sempre `INTEGER` — `REAL` em coluna de centavo é bug de valor
 * esperando data. Há teste que varre o esquema e falha se aparecer um.
 */

export type Migracao = {
  versao: number;
  nome: string;
  sql: string[];
};

export const migracoes: Migracao[] = [
  {
    versao: 1,
    nome: 'esquema-inicial',
    sql: [
      `CREATE TABLE contas (
         id TEXT PRIMARY KEY NOT NULL,
         nome TEXT NOT NULL,
         tipo TEXT NOT NULL,
         saldo_inicial_centavos INTEGER NOT NULL,
         cor TEXT NOT NULL,
         atualizado_em INTEGER NOT NULL
       )`,

      `CREATE TABLE transacoes (
         id TEXT PRIMARY KEY NOT NULL,
         conta_id TEXT NOT NULL,
         categoria_id TEXT NOT NULL,
         valor_centavos INTEGER NOT NULL,
         ocorrido_em TEXT NOT NULL,
         descricao TEXT NOT NULL,
         descricao_original TEXT,
         id_externo TEXT,
         origem TEXT NOT NULL,
         criado_em INTEGER NOT NULL,
         atualizado_em INTEGER NOT NULL
       )`,

      // Dedupe de ingestão. Ainda não há adapter, mas a restrição entra agora:
      // criar índice único depois, com dado duplicado já gravado, é migração
      // que falha no aparelho do usuário e não tem como voltar atrás.
      // Parcial porque lançamento manual não tem `id_externo`, e em SQLite
      // vários NULL não colidem — mas ser explícito documenta a intenção.
      `CREATE UNIQUE INDEX transacoes_id_externo
         ON transacoes (conta_id, id_externo)
         WHERE id_externo IS NOT NULL`,

      `CREATE INDEX transacoes_por_dia ON transacoes (ocorrido_em)`,
      `CREATE INDEX transacoes_por_conta ON transacoes (conta_id)`,

      `CREATE TABLE metas (
         id TEXT PRIMARY KEY NOT NULL,
         nome TEXT NOT NULL,
         alvo_centavos INTEGER NOT NULL,
         guardado_inicial_centavos INTEGER NOT NULL,
         prazo TEXT NOT NULL,
         cor TEXT NOT NULL,
         icone TEXT NOT NULL,
         atualizado_em INTEGER NOT NULL
       )`,

      `CREATE TABLE aportes (
         id TEXT PRIMARY KEY NOT NULL,
         meta_id TEXT NOT NULL,
         valor_centavos INTEGER NOT NULL,
         ocorrido_em TEXT NOT NULL,
         origem TEXT NOT NULL,
         criado_em INTEGER NOT NULL,
         atualizado_em INTEGER NOT NULL
       )`,

      `CREATE INDEX aportes_por_meta ON aportes (meta_id)`,

      `CREATE TABLE desafios (
         id TEXT PRIMARY KEY NOT NULL,
         nome TEXT NOT NULL,
         sub TEXT NOT NULL,
         sub_off TEXT NOT NULL,
         alvo INTEGER NOT NULL,
         unidade TEXT NOT NULL,
         acao TEXT NOT NULL,
         progresso INTEGER NOT NULL,
         automatico INTEGER NOT NULL,
         aceito INTEGER NOT NULL,
         categoria_id TEXT NOT NULL,
         economia_centavos INTEGER NOT NULL,
         atualizado_em INTEGER NOT NULL
       )`,

      `CREATE TABLE semanas_historicas (
         inicio TEXT PRIMARY KEY NOT NULL,
         registros INTEGER NOT NULL
       )`,

      `CREATE TABLE dias_sem_gasto (
         dia TEXT PRIMARY KEY NOT NULL
       )`,

      // Escalares do estado — meta semanal, dia do ritual, orçamento, semana
      // fechada. Chave-valor porque são poucos e mudam de forma independente;
      // uma coluna por preferência viraria migration a cada ajuste de produto.
      `CREATE TABLE preferencias (
         chave TEXT PRIMARY KEY NOT NULL,
         valor TEXT NOT NULL
       )`,
    ],
  },
  {
    versao: 2,
    nome: 'desafios-viram-catalogo',
    sql: [
      // A v1 guardava a DEFINIÇÃO do desafio (nome, alvo, ação) junto com o
      // progresso. Consequência: desafio publicado numa versão nova nunca
      // apareceria para quem já instalou, porque o app lia a lista do disco.
      // Agora a definição é catálogo em código e o banco guarda só o que é do
      // usuário.
      //
      // Entra como v2 em vez de corrigir a v1 porque a v1 já pode ter rodado
      // em algum aparelho de teste — e migration que já rodou não volta atrás.
      `CREATE TABLE progresso_desafios (
         id TEXT PRIMARY KEY NOT NULL,
         aceito INTEGER NOT NULL,
         progresso INTEGER NOT NULL,
         atualizado_em INTEGER NOT NULL
       )`,

      // Preserva o que o usuário já tinha andado antes de migrar.
      `INSERT INTO progresso_desafios (id, aceito, progresso, atualizado_em)
         SELECT id, aceito, progresso, atualizado_em FROM desafios`,

      `DROP TABLE desafios`,
    ],
  },
];

async function versaoAtual(motor: MotorSQL): Promise<number> {
  const linhas = await motor.consultar<{ user_version: number }>('PRAGMA user_version');
  return linhas[0]?.user_version ?? 0;
}

/**
 * Aplica o que faltar, em ordem, e devolve a versão final.
 *
 * Cada migration roda dentro da própria transação: se a v3 falhar, o banco
 * fica íntegro na v2 e a próxima abertura tenta de novo. Sem isso, uma falha
 * no meio deixaria metade das tabelas criadas e `user_version` mentindo.
 */
export async function aplicarMigracoes(motor: MotorSQL): Promise<number> {
  const daInstalacao = await versaoAtual(motor);
  const pendentes = migracoes
    .filter((m) => m.versao > daInstalacao)
    .sort((a, b) => a.versao - b.versao);

  for (const migracao of pendentes) {
    try {
      await motor.emTransacao(async () => {
        for (const comando of migracao.sql) await motor.executar(comando);
        // `user_version` não aceita parâmetro ligado; a versão vem da nossa
        // própria lista, nunca de entrada externa.
        await motor.executar(`PRAGMA user_version = ${migracao.versao}`);
      });
    } catch (causa) {
      throw new MigracaoFalhou(migracao.versao, migracao.nome, causa);
    }
  }

  return versaoAtual(motor);
}

/** Versão que o código espera encontrar. */
export const VERSAO_ESPERADA = migracoes[migracoes.length - 1].versao;
