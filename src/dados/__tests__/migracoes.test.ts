/** @jest-environment node */
import { MigracaoFalhou } from '../../dominio/erros';
import { aplicarMigracoes, migracoes, VERSAO_ESPERADA } from '../migracoes';
import { MotorSQL } from '../motor';
import { criarMotorNode } from './motorNode';

/**
 * Migration é o único código do app que roda contra dado que já existe no
 * aparelho de outra pessoa. Não dá para testar depois.
 */

const versao = async (m: MotorSQL) =>
  (await m.consultar<{ user_version: number }>('PRAGMA user_version'))[0].user_version;

const tabelas = async (m: MotorSQL) =>
  (
    await m.consultar<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    )
  ).map((t) => t.name);

describe('lista de migrations', () => {
  it('as versões são únicas, começam em 1 e não pulam número', () => {
    const versoes = migracoes.map((m) => m.versao);
    expect(versoes).toEqual([...new Set(versoes)]);
    expect(versoes).toEqual(Array.from({ length: migracoes.length }, (_, i) => i + 1));
  });

  it('toda migration tem nome e pelo menos um comando', () => {
    for (const m of migracoes) {
      expect(m.nome).not.toBe('');
      expect(m.sql.length).toBeGreaterThan(0);
    }
  });
});

describe('aplicar do zero', () => {
  it('leva o banco à versão esperada', async () => {
    const motor = criarMotorNode();
    expect(await versao(motor)).toBe(0);
    expect(await aplicarMigracoes(motor)).toBe(VERSAO_ESPERADA);
    expect(await versao(motor)).toBe(VERSAO_ESPERADA);
  });

  it('cria o esquema completo', async () => {
    const motor = criarMotorNode();
    await aplicarMigracoes(motor);
    expect(await tabelas(motor)).toEqual([
      'aportes',
      'contas',
      'dias_sem_gasto',
      'metas',
      'preferencias',
      'progresso_desafios',
      'transacoes',
    ]);
  });

  it('a v3 derruba a tabela de semanas — a constância virou derivada', async () => {
    const motor = criarMotorNode();
    await aplicarMigracoes(motor);
    expect(await tabelas(motor)).not.toContain('semanas_historicas');
  });

  it('a v2 preserva o progresso que já existia na v1', async () => {
    const motor = criarMotorNode();

    // Aplica só a v1 e grava um desafio no formato antigo, como um aparelho
    // que instalou o app antes da mudança.
    const soV1 = { ...motor, consultar: motor.consultar };
    await motor.emTransacao(async () => {
      for (const comando of migracoes[0].sql) await soV1.executar(comando);
      await soV1.executar('PRAGMA user_version = 1');
    });
    await motor.executar(
      `INSERT INTO desafios (id, nome, sub, sub_off, alvo, unidade, acao, progresso,
         automatico, aceito, categoria_id, economia_centavos, atualizado_em)
       VALUES ('cafe', 'Café', '', '', 5, 'dias', 'Marcar', 3, 0, 1, 'restaurante', 6000, 1)`,
    );

    expect(await aplicarMigracoes(motor)).toBe(VERSAO_ESPERADA);

    const linhas = await motor.consultar<{ id: string; aceito: number; progresso: number }>(
      'SELECT id, aceito, progresso FROM progresso_desafios',
    );
    expect(linhas).toEqual([{ id: 'cafe', aceito: 1, progresso: 3 }]);
  });

  it('a v4 converte o prazo antigo em NULL e preserva o que já era data', async () => {
    const motor = criarMotorNode();

    // Aparelho parado na v3, com o prazo ainda como texto pré-formatado.
    await motor.emTransacao(async () => {
      for (const m of migracoes.slice(0, 3)) {
        for (const comando of m.sql) await motor.executar(comando);
      }
      await motor.executar('PRAGMA user_version = 3');
    });
    await motor.executar(
      `INSERT INTO metas (id, nome, alvo_centavos, guardado_inicial_centavos, prazo, cor, icone,
         atualizado_em)
       VALUES ('chile', 'Chile', 800000, 320000, 'faltam 134 dias · 15 dez 2026', 'accent', 'x', 1),
              ('nova', 'Nova', 100000, 0, '2027-01-31', 'accent', 'x', 1)`,
    );

    expect(await aplicarMigracoes(motor)).toBe(VERSAO_ESPERADA);

    const linhas = await motor.consultar<{ id: string; prazo: string | null }>(
      'SELECT id, prazo FROM metas ORDER BY id',
    );
    // O texto antigo não é recuperável como data: ele dependia de um "hoje" que
    // já passou. Vira meta sem prazo, que a pessoa redefine em um toque.
    expect(linhas).toEqual([
      { id: 'chile', prazo: null },
      { id: 'nova', prazo: '2027-01-31' },
    ]);
  });

  it('a v4 mantém o resto da meta intacto', async () => {
    const motor = criarMotorNode();
    await motor.emTransacao(async () => {
      for (const m of migracoes.slice(0, 3)) {
        for (const comando of m.sql) await motor.executar(comando);
      }
      await motor.executar('PRAGMA user_version = 3');
    });
    await motor.executar(
      `INSERT INTO metas (id, nome, alvo_centavos, guardado_inicial_centavos, prazo, cor, icone,
         atualizado_em)
       VALUES ('chile', 'Chile', 800000, 320000, 'faltam 134 dias', 'hex:#2f6f8f', 'M2 12h20', 7)`,
    );

    await aplicarMigracoes(motor);

    const [linha] = await motor.consultar<Record<string, unknown>>('SELECT * FROM metas');
    expect(linha).toEqual({
      id: 'chile',
      nome: 'Chile',
      alvo_centavos: 800000,
      guardado_inicial_centavos: 320000,
      prazo: null,
      cor: 'hex:#2f6f8f',
      icone: 'M2 12h20',
      atualizado_em: 7,
    });
  });

  it('é idempotente — rodar de novo não faz nada', async () => {
    const motor = criarMotorNode();
    await aplicarMigracoes(motor);
    const antes = await tabelas(motor);

    expect(await aplicarMigracoes(motor)).toBe(VERSAO_ESPERADA);
    expect(await tabelas(motor)).toEqual(antes);
  });
});

describe('dinheiro no esquema', () => {
  it('toda coluna de centavos é INTEGER — REAL aqui é bug de valor', async () => {
    const motor = criarMotorNode();
    await aplicarMigracoes(motor);

    let conferidas = 0;
    for (const tabela of await tabelas(motor)) {
      const colunas = await motor.consultar<{ name: string; type: string }>(
        `PRAGMA table_info(${tabela})`,
      );
      for (const coluna of colunas) {
        if (!coluna.name.endsWith('_centavos')) continue;
        expect(coluna.type).toBe('INTEGER');
        conferidas += 1;
      }
    }
    // Se alguém renomear as colunas e este número cair para zero, o teste
    // passaria sem conferir nada.
    expect(conferidas).toBeGreaterThanOrEqual(5);
  });
});

describe('falha no meio', () => {
  it('não avança a versão e embrulha a causa', async () => {
    const motor = criarMotorNode();
    const quebrado: MotorSQL = {
      ...motor,
      executar: async (sql, p) => {
        if (sql.includes('CREATE TABLE metas')) throw new Error('disco cheio');
        return motor.executar(sql, p);
      },
    };

    await expect(aplicarMigracoes(quebrado)).rejects.toBeInstanceOf(MigracaoFalhou);
    // A transação desfez tudo: o banco continua virgem, e a próxima abertura
    // tenta de novo do começo em vez de encontrar meio esquema.
    expect(await versao(motor)).toBe(0);
    expect(await tabelas(motor)).toEqual([]);
  });
});

describe('dedupe de ingestão', () => {
  it('o mesmo id externo não entra duas vezes na mesma conta', async () => {
    const motor = criarMotorNode();
    await aplicarMigracoes(motor);

    const inserir = (id: string, contaId: string, idExterno: string | null) =>
      motor.executar(
        `INSERT INTO transacoes (id, conta_id, categoria_id, valor_centavos, ocorrido_em,
           descricao, descricao_original, id_externo, origem, criado_em, atualizado_em)
         VALUES (?, ?, 'mercado', -100, '2026-08-05', 'x', NULL, ?, 'ofx', 1, 1)`,
        [id, contaId, idExterno],
      );

    await inserir('a', 'cartao', 'FITID-1');
    await expect(inserir('b', 'cartao', 'FITID-1')).rejects.toThrow();

    // Mesmo FITID em outra conta é outro lançamento, e deve passar.
    await expect(inserir('c', 'corrente', 'FITID-1')).resolves.toBeUndefined();
  });

  it('lançamento manual não colide — vários sem id externo convivem', async () => {
    const motor = criarMotorNode();
    await aplicarMigracoes(motor);

    const manual = (id: string) =>
      motor.executar(
        `INSERT INTO transacoes (id, conta_id, categoria_id, valor_centavos, ocorrido_em,
           descricao, descricao_original, id_externo, origem, criado_em, atualizado_em)
         VALUES (?, 'cartao', 'mercado', -100, '2026-08-05', 'x', NULL, NULL, 'manual', 1, 1)`,
        [id],
      );

    await manual('a');
    await expect(manual('b')).resolves.toBeUndefined();
  });
});
