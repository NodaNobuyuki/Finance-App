import { EscritaFalhou, LeituraFalhou } from '../dominio/erros';
import { Aporte, Conta, Meta, Origem, ProgressoDesafio, Transacao } from '../dominio/tipos';
import { CorRef } from '../tema/paletas';
import { diferencaDeChaves, diferencaPorId, Diferenca, vazia } from './diff';
import { aplicarMigracoes } from './migracoes';
import { MotorSQL, Parametro } from './motor';
import { EstadoPersistido } from './persistido';
import { RepositorioLocal } from './repositorio';

/**
 * Persistência em SQL, escrita contra `MotorSQL` — não contra `expo-sqlite`.
 * É o que permite exercitar este arquivo inteiro no Jest, com SQLite de verdade.
 */

/* ── Conversão linha ⇄ entidade ───────────────────────────────── */

/**
 * `CorRef` é união (`token` ou `hex`) e vai como JSON numa coluna TEXT.
 * Não é dado consultável — ninguém vai filtrar transação por cor — então
 * normalizar em colunas só criaria migration sem uso.
 */
const corParaTexto = (cor: CorRef): string => JSON.stringify(cor);
const corDeTexto = (texto: string): CorRef => JSON.parse(texto) as CorRef;

const booleanoParaInt = (v: boolean): number => (v ? 1 : 0);
const intParaBooleano = (v: number): boolean => v === 1;

type LinhaConta = {
  id: string;
  nome: string;
  tipo: string;
  saldo_inicial_centavos: number;
  cor: string;
};

type LinhaTransacao = {
  id: string;
  conta_id: string;
  categoria_id: string;
  valor_centavos: number;
  ocorrido_em: string;
  descricao: string;
  descricao_original: string | null;
  id_externo: string | null;
  origem: string;
  criado_em: number;
};

type LinhaMeta = {
  id: string;
  nome: string;
  alvo_centavos: number;
  guardado_inicial_centavos: number;
  /** NULL quando a meta não tem prazo — ver migration v4. */
  prazo: string | null;
  cor: string;
  icone: string;
};

type LinhaAporte = {
  id: string;
  meta_id: string;
  valor_centavos: number;
  ocorrido_em: string;
  origem: string;
  criado_em: number;
};

type LinhaProgressoDesafio = {
  id: string;
  aceito: number;
  progresso: number;
};

/* ── Tabelas, cada uma com seu mapeamento ─────────────────────── */

type Tabela<T extends { id: string }, L> = {
  nome: string;
  colunas: string[];
  paraLinha: (item: T, agoraMs: number) => Parametro[];
  daLinha: (linha: L) => T;
};

const TABELA_CONTAS: Tabela<Conta, LinhaConta> = {
  nome: 'contas',
  colunas: ['id', 'nome', 'tipo', 'saldo_inicial_centavos', 'cor', 'atualizado_em'],
  paraLinha: (c, agoraMs) => [
    c.id,
    c.nome,
    c.tipo,
    c.saldoInicialCentavos,
    corParaTexto(c.cor),
    agoraMs,
  ],
  daLinha: (l) => ({
    id: l.id,
    nome: l.nome,
    tipo: l.tipo as Conta['tipo'],
    saldoInicialCentavos: l.saldo_inicial_centavos,
    cor: corDeTexto(l.cor),
  }),
};

const TABELA_TRANSACOES: Tabela<Transacao, LinhaTransacao> = {
  nome: 'transacoes',
  colunas: [
    'id',
    'conta_id',
    'categoria_id',
    'valor_centavos',
    'ocorrido_em',
    'descricao',
    'descricao_original',
    'id_externo',
    'origem',
    'criado_em',
    'atualizado_em',
  ],
  paraLinha: (t, agoraMs) => [
    t.id,
    t.contaId,
    t.categoriaId,
    t.valorCentavos,
    t.ocorridoEm,
    t.descricao,
    t.descricaoOriginal ?? null,
    t.idExterno ?? null,
    t.origem,
    t.criadoEm,
    agoraMs,
  ],
  daLinha: (l) => ({
    id: l.id,
    contaId: l.conta_id,
    categoriaId: l.categoria_id,
    valorCentavos: l.valor_centavos,
    ocorridoEm: l.ocorrido_em,
    descricao: l.descricao,
    ...(l.descricao_original === null ? {} : { descricaoOriginal: l.descricao_original }),
    ...(l.id_externo === null ? {} : { idExterno: l.id_externo }),
    origem: l.origem as Origem,
    criadoEm: l.criado_em,
  }),
};

const TABELA_METAS: Tabela<Meta, LinhaMeta> = {
  nome: 'metas',
  colunas: [
    'id',
    'nome',
    'alvo_centavos',
    'guardado_inicial_centavos',
    'prazo',
    'cor',
    'icone',
    'atualizado_em',
  ],
  paraLinha: (m, agoraMs) => [
    m.id,
    m.nome,
    m.alvoCentavos,
    m.guardadoInicialCentavos,
    m.prazo,
    corParaTexto(m.cor),
    m.icone,
    agoraMs,
  ],
  daLinha: (l) => ({
    id: l.id,
    nome: l.nome,
    alvoCentavos: l.alvo_centavos,
    guardadoInicialCentavos: l.guardado_inicial_centavos,
    prazo: l.prazo,
    cor: corDeTexto(l.cor),
    icone: l.icone,
  }),
};

const TABELA_APORTES: Tabela<Aporte, LinhaAporte> = {
  nome: 'aportes',
  colunas: [
    'id',
    'meta_id',
    'valor_centavos',
    'ocorrido_em',
    'origem',
    'criado_em',
    'atualizado_em',
  ],
  paraLinha: (a, agoraMs) => [
    a.id,
    a.metaId,
    a.valorCentavos,
    a.ocorridoEm,
    a.origem,
    a.criadoEm,
    agoraMs,
  ],
  daLinha: (l) => ({
    id: l.id,
    metaId: l.meta_id,
    valorCentavos: l.valor_centavos,
    ocorridoEm: l.ocorrido_em,
    origem: l.origem as Origem,
    criadoEm: l.criado_em,
  }),
};

const TABELA_PROGRESSO_DESAFIOS: Tabela<ProgressoDesafio, LinhaProgressoDesafio> = {
  nome: 'progresso_desafios',
  colunas: ['id', 'aceito', 'progresso', 'atualizado_em'],
  paraLinha: (p, agoraMs) => [p.id, booleanoParaInt(p.aceito), p.progresso, agoraMs],
  daLinha: (l) => ({
    id: l.id,
    aceito: intParaBooleano(l.aceito),
    progresso: l.progresso,
  }),
};

/* ── Preferências (escalares) ─────────────────────────────────── */

type Preferencias = Pick<
  EstadoPersistido,
  | 'perfil'
  | 'orcamentoMensalCentavos'
  | 'contexto'
  | 'onboardingConcluido'
  | 'metaSemanal'
  | 'ritualDiaFechamento'
  | 'ritualPrimeira'
  | 'lembrete'
  | 'semanaFechada'
  | 'intencao'
  | 'mostrarSaldo'
>;

function preferenciasDe(e: EstadoPersistido): Preferencias {
  return {
    perfil: e.perfil,
    orcamentoMensalCentavos: e.orcamentoMensalCentavos,
    contexto: e.contexto,
    onboardingConcluido: e.onboardingConcluido,
    metaSemanal: e.metaSemanal,
    ritualDiaFechamento: e.ritualDiaFechamento,
    ritualPrimeira: e.ritualPrimeira,
    lembrete: e.lembrete,
    semanaFechada: e.semanaFechada,
    intencao: e.intencao,
    mostrarSaldo: e.mostrarSaldo,
  };
}

/* ── Repositório ──────────────────────────────────────────────── */

export function criarRepositorioSQL(
  motor: MotorSQL,
  agoraMs: () => number = () => Date.now(),
): RepositorioLocal {
  async function sincronizar<T extends { id: string }, L>(
    tabela: Tabela<T, L>,
    d: Diferenca<T>,
  ): Promise<void> {
    if (vazia(d)) return;
    const marcas = tabela.colunas.map(() => '?').join(', ');
    const agora = agoraMs();

    // `INSERT OR REPLACE` cobre inserção e atualização com um comando só; a
    // chave primária é o id, então não há caminho para duplicar linha.
    for (const item of [...d.inserir, ...d.atualizar]) {
      await motor.executar(
        `INSERT OR REPLACE INTO ${tabela.nome} (${tabela.colunas.join(', ')}) VALUES (${marcas})`,
        tabela.paraLinha(item, agora),
      );
    }

    for (const id of d.remover) {
      await motor.executar(`DELETE FROM ${tabela.nome} WHERE id = ?`, [id]);
    }
  }

  async function gravarPreferencias(p: Preferencias): Promise<void> {
    for (const [chave, valor] of Object.entries(p)) {
      await motor.executar(
        `INSERT OR REPLACE INTO preferencias (chave, valor) VALUES (?, ?)`,
        // JSON preserva o tipo na volta: número volta número, `null` volta
        // `null`. Guardar `String(valor)` transformaria tudo em texto e o
        // `semanaFechada: null` reapareceria como a string "null".
        [chave, JSON.stringify(valor)],
      );
    }
  }

  return {
    async iniciar() {
      await aplicarMigracoes(motor);
    },

    async carregar() {
      try {
        const prefs = await motor.consultar<{ chave: string; valor: string }>(
          'SELECT chave, valor FROM preferencias',
        );
        // Nunca gravado: primeiro uso. Distinto de "gravado e vazio", que é
        // um usuário que apagou tudo e deve continuar com o app vazio.
        if (prefs.length === 0) return null;

        const guardadas = Object.fromEntries(
          prefs.map((p) => [p.chave, JSON.parse(p.valor)]),
        ) as Preferencias;

        const [contas, transacoes, metas, aportes, progressos, dias] = await Promise.all([
          motor.consultar<LinhaConta>(`SELECT * FROM contas`),
          motor.consultar<LinhaTransacao>(
            `SELECT * FROM transacoes ORDER BY ocorrido_em DESC, criado_em DESC`,
          ),
          motor.consultar<LinhaMeta>(`SELECT * FROM metas`),
          motor.consultar<LinhaAporte>(`SELECT * FROM aportes ORDER BY criado_em DESC`),
          motor.consultar<LinhaProgressoDesafio>(`SELECT * FROM progresso_desafios`),
          motor.consultar<{ dia: string }>(`SELECT dia FROM dias_sem_gasto ORDER BY dia`),
        ]);

        return {
          contas: contas.map(TABELA_CONTAS.daLinha),
          transacoes: transacoes.map(TABELA_TRANSACOES.daLinha),
          metas: metas.map(TABELA_METAS.daLinha),
          aportes: aportes.map(TABELA_APORTES.daLinha),
          progressoDesafios: progressos.map(TABELA_PROGRESSO_DESAFIOS.daLinha),
          diasSemGasto: dias.map((d) => d.dia),
          ...guardadas,
        } satisfies EstadoPersistido;
      } catch (causa) {
        throw new LeituraFalhou('o estado salvo', causa);
      }
    },

    async salvar(antes, depois) {
      try {
        // Uma transação para o estado inteiro: ou o disco reflete um instante
        // coerente, ou não muda nada. Metade de um lote gravado seria pior que
        // nada — o saldo derivado passaria a somar lançamento sem par.
        await motor.emTransacao(async () => {
          await sincronizar(TABELA_CONTAS, diferencaPorId(antes?.contas ?? [], depois.contas));
          await sincronizar(
            TABELA_TRANSACOES,
            diferencaPorId(antes?.transacoes ?? [], depois.transacoes),
          );
          await sincronizar(TABELA_METAS, diferencaPorId(antes?.metas ?? [], depois.metas));
          await sincronizar(TABELA_APORTES, diferencaPorId(antes?.aportes ?? [], depois.aportes));
          await sincronizar(
            TABELA_PROGRESSO_DESAFIOS,
            diferencaPorId(antes?.progressoDesafios ?? [], depois.progressoDesafios),
          );

          if (antes?.diasSemGasto !== depois.diasSemGasto) {
            const d = diferencaDeChaves(antes?.diasSemGasto ?? [], depois.diasSemGasto);
            for (const dia of d.inserir) {
              await motor.executar(`INSERT OR REPLACE INTO dias_sem_gasto (dia) VALUES (?)`, [dia]);
            }
            for (const dia of d.remover) {
              await motor.executar(`DELETE FROM dias_sem_gasto WHERE dia = ?`, [dia]);
            }
          }

          await gravarPreferencias(preferenciasDe(depois));
        });
      } catch (causa) {
        throw new EscritaFalhou('o estado', causa);
      }
    },

    async apagarTudo() {
      try {
        await motor.emTransacao(async () => {
          for (const tabela of [
            'transacoes',
            'aportes',
            'contas',
            'metas',
            'progresso_desafios',
            'dias_sem_gasto',
            'preferencias',
          ]) {
            await motor.executar(`DELETE FROM ${tabela}`);
          }
        });
      } catch (causa) {
        throw new EscritaFalhou('a limpeza do banco', causa);
      }
    },

    fechar: () => motor.fechar(),
  };
}
