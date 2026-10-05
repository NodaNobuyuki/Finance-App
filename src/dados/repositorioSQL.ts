import { EscritaFalhou, LeituraFalhou } from '../dominio/erros';
import { Categoria } from '../dominio/categorias';
import { DecisaoRecorrencia } from '../dominio/recorrencia';
import { Conta, Meta, Origem, ProgressoDesafio, Transacao } from '../dominio/tipos';
import { CorRef } from '../tema/paletas';
import { diferencaDeChaves, diferencaPorId, Diferenca, vazia } from './diff';
import { aplicarMigracoes } from './migracoes';
import { ehRecusaDeRestricao, MotorSQL, Parametro } from './motor';
import { EstadoPersistido } from './persistido';
import { Recusa, RepositorioLocal } from './repositorio';

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
  /** NULL quando nenhum extrato foi importado para a conta — ver migration v10. */
  id_no_banco: string | null;
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
  transferencia_id: string | null;
  meta_id: string | null;
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
  conta_id: string;
  cor: string;
  icone: string;
};

type LinhaCategoria = {
  id: string;
  nome: string;
  tipo: string;
  cor: string;
  icone: string;
  limite_centavos: number;
};

type LinhaProgressoDesafio = {
  id: string;
  aceito: number;
  progresso: number;
};

type LinhaDecisaoRecorrencia = {
  id: string;
  decisao: string;
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
  colunas: ['id', 'nome', 'tipo', 'saldo_inicial_centavos', 'cor', 'id_no_banco', 'atualizado_em'],
  paraLinha: (c, agoraMs) => [
    c.id,
    c.nome,
    c.tipo,
    c.saldoInicialCentavos,
    corParaTexto(c.cor),
    c.idNoBanco ?? null,
    agoraMs,
  ],
  daLinha: (l) => ({
    id: l.id,
    nome: l.nome,
    tipo: l.tipo as Conta['tipo'],
    saldoInicialCentavos: l.saldo_inicial_centavos,
    cor: corDeTexto(l.cor),
    ...(l.id_no_banco === null ? {} : { idNoBanco: l.id_no_banco }),
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
    'transferencia_id',
    'meta_id',
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
    t.transferenciaId ?? null,
    t.metaId ?? null,
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
    ...(l.transferencia_id === null ? {} : { transferenciaId: l.transferencia_id }),
    ...(l.meta_id === null ? {} : { metaId: l.meta_id }),
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
    'conta_id',
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
    m.contaId,
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
    contaId: l.conta_id,
    cor: corDeTexto(l.cor),
    icone: l.icone,
  }),
};

const TABELA_CATEGORIAS: Tabela<Categoria, LinhaCategoria> = {
  nome: 'categorias',
  colunas: ['id', 'nome', 'tipo', 'cor', 'icone', 'limite_centavos', 'atualizado_em'],
  paraLinha: (c, agoraMs) => [
    c.id,
    c.nome,
    c.tipo,
    corParaTexto(c.cor),
    c.icone,
    c.limiteCentavos,
    agoraMs,
  ],
  daLinha: (l) => ({
    id: l.id,
    nome: l.nome,
    tipo: l.tipo as Categoria['tipo'],
    cor: corDeTexto(l.cor),
    icone: l.icone,
    limiteCentavos: l.limite_centavos,
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

const TABELA_DECISOES_RECORRENCIA: Tabela<DecisaoRecorrencia, LinhaDecisaoRecorrencia> = {
  nome: 'decisoes_recorrencia',
  colunas: ['id', 'decisao', 'atualizado_em'],
  paraLinha: (r, agoraMs) => [r.id, r.decisao, agoraMs],
  daLinha: (l) => ({ id: l.id, decisao: l.decisao as DecisaoRecorrencia['decisao'] }),
};

/* ── Preferências (escalares) ─────────────────────────────────── */

type Preferencias = Pick<
  EstadoPersistido,
  | 'perfil'
  | 'onboardingConcluido'
  | 'metaSemanal'
  | 'ritualDiaFechamento'
  | 'ritualPrimeira'
  | 'lembrete'
  | 'semanaFechada'
  | 'ultimoBackupEm'
  | 'pagueSePrimeiro'
  | 'intencao'
  | 'mostrarSaldo'
>;

function preferenciasDe(e: EstadoPersistido): Preferencias {
  return {
    perfil: e.perfil,
    onboardingConcluido: e.onboardingConcluido,
    metaSemanal: e.metaSemanal,
    ritualDiaFechamento: e.ritualDiaFechamento,
    ritualPrimeira: e.ritualPrimeira,
    lembrete: e.lembrete,
    semanaFechada: e.semanaFechada,
    ultimoBackupEm: e.ultimoBackupEm,
    pagueSePrimeiro: e.pagueSePrimeiro,
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
  ): Promise<Recusa[]> {
    if (vazia(d)) return [];
    const marcas = tabela.colunas.map(() => '?').join(', ');
    const atribuicoes = tabela.colunas
      .filter((c) => c !== 'id')
      .map((c) => `${c} = excluded.${c}`)
      .join(', ');
    const agora = agoraMs();
    const recusadas: Recusa[] = [];

    // Remoção antes da escrita: trocar uma linha por outra com o mesmo
    // `id_externo` na mesma gravação tem de liberar a chave antes de ocupá-la.
    for (const id of d.remover) {
      await motor.executar(`DELETE FROM ${tabela.nome} WHERE id = ?`, [id]);
    }

    // Upsert pela chave primária, e SÓ por ela. Era `INSERT OR REPLACE`, que
    // resolve conflito em QUALQUER restrição única apagando a linha que estava
    // lá: um segundo lançamento com o mesmo FITID fazia o primeiro sumir do
    // disco sem aviso, enquanto a memória seguia mostrando os dois.
    for (const item of [...d.inserir, ...d.atualizar]) {
      try {
        await motor.executar(
          `INSERT INTO ${tabela.nome} (${tabela.colunas.join(', ')}) VALUES (${marcas})
           ON CONFLICT (id) DO UPDATE SET ${atribuicoes}`,
          tabela.paraLinha(item, agora),
        );
      } catch (erro) {
        // Restrição violada desfaz só este comando — o SQLite mantém a
        // transação viva e o resto do lote entra. Qualquer outra falha é o
        // mundo quebrando, e aí a gravação inteira volta atrás.
        //
        // O par de uma transferência pode, em tese, perder uma ponta aqui. Na
        // prática as pontas não têm `id_externo` nem campo nulo, e travar o
        // disco inteiro por uma linha era a perda maior.
        if (!ehRecusaDeRestricao(erro)) throw erro;
        recusadas.push({ tabela: tabela.nome, id: item.id });
      }
    }

    return recusadas;
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

        const [contas, transacoes, metas, categorias, progressos, dias, decisoes] =
          await Promise.all([
            motor.consultar<LinhaConta>(`SELECT * FROM contas`),
            motor.consultar<LinhaTransacao>(
              `SELECT * FROM transacoes ORDER BY ocorrido_em DESC, criado_em DESC`,
            ),
            motor.consultar<LinhaMeta>(`SELECT * FROM metas`),
            motor.consultar<LinhaCategoria>(`SELECT * FROM categorias`),
            motor.consultar<LinhaProgressoDesafio>(`SELECT * FROM progresso_desafios`),
            motor.consultar<{ dia: string }>(`SELECT dia FROM dias_sem_gasto ORDER BY dia`),
            motor.consultar<LinhaDecisaoRecorrencia>(`SELECT * FROM decisoes_recorrencia`),
          ]);

        return {
          contas: contas.map(TABELA_CONTAS.daLinha),
          transacoes: transacoes.map(TABELA_TRANSACOES.daLinha),
          metas: metas.map(TABELA_METAS.daLinha),
          categorias: categorias.map(TABELA_CATEGORIAS.daLinha),
          progressoDesafios: progressos.map(TABELA_PROGRESSO_DESAFIOS.daLinha),
          diasSemGasto: dias.map((d) => d.dia),
          decisoesDeRecorrencia: decisoes.map(TABELA_DECISOES_RECORRENCIA.daLinha),
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
        // nada — o saldo derivado passaria a somar lançamento sem par. A única
        // exceção é a linha recusada por restrição, que fica de fora sozinha.
        return await motor.emTransacao(async () => {
          const recusadas = [
            ...(await sincronizar(
              TABELA_CONTAS,
              diferencaPorId(antes?.contas ?? [], depois.contas),
            )),
            ...(await sincronizar(
              TABELA_TRANSACOES,
              diferencaPorId(antes?.transacoes ?? [], depois.transacoes),
            )),
            ...(await sincronizar(TABELA_METAS, diferencaPorId(antes?.metas ?? [], depois.metas))),
            ...(await sincronizar(
              TABELA_CATEGORIAS,
              diferencaPorId(antes?.categorias ?? [], depois.categorias),
            )),
            ...(await sincronizar(
              TABELA_PROGRESSO_DESAFIOS,
              diferencaPorId(antes?.progressoDesafios ?? [], depois.progressoDesafios),
            )),
            ...(await sincronizar(
              TABELA_DECISOES_RECORRENCIA,
              diferencaPorId(antes?.decisoesDeRecorrencia ?? [], depois.decisoesDeRecorrencia),
            )),
          ];

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
          return { recusadas };
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
            'contas',
            'metas',
            'categorias',
            'progresso_desafios',
            'dias_sem_gasto',
            'decisoes_recorrencia',
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
