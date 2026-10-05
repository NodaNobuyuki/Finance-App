import { z } from 'zod';
import { DiaRitualId, diasRitual } from '../dominio/datas';
import { ErroDeDominio } from '../dominio/erros';
import { paletas, paletaPadrao, Tokens } from '../tema/paletas';
import { EstadoPersistido } from './persistido';

/**
 * Backup em JSON: o mesmo recorte que vai para o disco, num arquivo que a
 * pessoa leva para onde quiser.
 *
 * O app é só local. Sem isto, perder ou trocar o celular apaga o histórico
 * inteiro — e a constância, que é derivada dele, junto.
 *
 * O formato é o do DOMÍNIO (`EstadoPersistido`), não o do SQLite: o esquema do
 * banco muda por migration, e um backup feito hoje precisa continuar legível
 * depois da v20. Quem muda o formato do arquivo é `VERSAO_BACKUP`, não o banco.
 */

export const FORMATO_BACKUP = 'poupa-bloco-backup';

/**
 * Sobe quando o formato do arquivo mudar de um jeito que a leitura antiga não
 * entende. Backup de versão mais nova é recusado com recado — ler pela metade
 * restauraria dado faltando sem ninguém perceber.
 */
export const VERSAO_BACKUP = 1;

/** O arquivo não é um backup que dê para restaurar. Explicável, não retentável. */
export class BackupInvalido extends ErroDeDominio {
  constructor(mensagem: string, causa?: unknown) {
    super('backup-invalido', mensagem, causa);
  }
}

/* ── Esquema ──────────────────────────────────────────────────────
   A entrada é suja por definição: arquivo editado à mão, de outro app,
   cortado no meio de um envio. Zod na fronteira, como manda a regra. */

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'data fora do formato AAAA-MM-DD');
/** Dinheiro é inteiro em centavos — float aqui seria bug de arredondamento importado. */
const centavos = z.number().int();
const id = z.string().min(1);

const chavesDeToken = Object.keys(paletas[paletaPadrao].tokens) as [
  keyof Tokens,
  ...(keyof Tokens)[],
];
const corRef = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('token'), token: z.enum(chavesDeToken) }),
  z.object({ tipo: z.literal('hex'), hex: z.string().regex(/^#[0-9a-fA-F]{3,8}$/) }),
]);

const transacao = z.object({
  id,
  contaId: id,
  categoriaId: z.string(),
  valorCentavos: centavos,
  ocorridoEm: dia,
  descricao: z.string(),
  descricaoOriginal: z.string().optional(),
  idExterno: z.string().optional(),
  transferenciaId: z.string().optional(),
  metaId: z.string().optional(),
  origem: z.enum(['manual', 'ofx', 'notification', 'email', 'csv']),
  criadoEm: z.number(),
});

const conta = z.object({
  id,
  nome: z.string(),
  tipo: z.enum(['carteira', 'corrente', 'cartao', 'poupanca']),
  saldoInicialCentavos: centavos,
  cor: corRef,
});

const meta = z.object({
  id,
  nome: z.string(),
  alvoCentavos: centavos,
  guardadoInicialCentavos: centavos,
  contaId: id,
  prazo: dia.nullable(),
  cor: corRef,
  icone: z.string(),
});

const categoria = z.object({
  id,
  nome: z.string(),
  tipo: z.enum(['despesa', 'receita', 'transferencia']),
  cor: corRef,
  icone: z.string(),
  limiteCentavos: centavos.nonnegative(),
});

const dados = z.object({
  perfil: z.object({ nome: z.string() }),
  transacoes: z.array(transacao),
  contas: z.array(conta).min(1, 'o backup não tem nenhuma conta'),
  metas: z.array(meta),
  categorias: z.array(categoria),
  progressoDesafios: z.array(
    z.object({ id, aceito: z.boolean(), progresso: z.number().int().nonnegative() }),
  ),
  diasSemGasto: z.array(dia),
  onboardingConcluido: z.boolean(),
  metaSemanal: z.number().int().min(1).max(7),
  ritualDiaFechamento: z.enum(diasRitual.map((d) => d.id) as [DiaRitualId, ...DiaRitualId[]]),
  ritualPrimeira: z.boolean(),
  lembrete: z.string(),
  semanaFechada: dia.nullable(),
  intencao: z.string(),
  mostrarSaldo: z.boolean(),
});

const arquivo = z.object({
  formato: z.literal(FORMATO_BACKUP),
  versao: z.number().int(),
  geradoEm: z.string(),
  dados: z.unknown(),
});

/* ── Gerar ──────────────────────────────────────────────────────── */

export function gerarBackup(conteudo: EstadoPersistido, geradoEmMs: number): string {
  return JSON.stringify(
    {
      formato: FORMATO_BACKUP,
      versao: VERSAO_BACKUP,
      geradoEm: new Date(geradoEmMs).toISOString(),
      dados: conteudo,
    },
    null,
    1,
  );
}

/** `poupa-bloco-2026-08-05.json` — a data no nome ordena os backups na pasta. */
export function nomeDoBackup(hoje: string): string {
  return `poupa-bloco-${hoje}.json`;
}

/* ── Ler ────────────────────────────────────────────────────────── */

/**
 * Lê e valida um backup. Lança `BackupInvalido` com uma frase que a pessoa
 * entende — nunca o caminho do Zod.
 *
 * Valida também o que o esquema sozinho não vê: id repetido e lançamento
 * apontando para conta que não está no arquivo. Os dois passariam pelo
 * reducer e só apareceriam no banco, como linha recusada que some ao fechar
 * o app. Categoria e meta ausentes NÃO são erro: categoria órfã e entrada de
 * meta apagada são caminhos normais do app.
 */
export function lerBackup(texto: string): EstadoPersistido {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch (erro) {
    throw new BackupInvalido('Este arquivo não é um backup do Poupa Bloco.', erro);
  }

  const cabecalho = arquivo.safeParse(bruto);
  if (!cabecalho.success) {
    throw new BackupInvalido('Este arquivo não é um backup do Poupa Bloco.', cabecalho.error);
  }
  if (cabecalho.data.versao > VERSAO_BACKUP) {
    throw new BackupInvalido(
      'Este backup foi feito por uma versão mais nova do app. Atualize o app para restaurar.',
    );
  }

  const lido = dados.safeParse(cabecalho.data.dados);
  if (!lido.success) {
    throw new BackupInvalido('O backup está incompleto ou foi alterado.', lido.error);
  }
  const d: EstadoPersistido = lido.data;

  const repetido = (ids: string[]) => new Set(ids).size !== ids.length;
  if (
    repetido(d.transacoes.map((t) => t.id)) ||
    repetido(d.contas.map((c) => c.id)) ||
    repetido(d.metas.map((m) => m.id)) ||
    repetido(d.categorias.map((c) => c.id))
  ) {
    throw new BackupInvalido('O backup tem registros repetidos.');
  }

  // Mesma unicidade que o índice `(conta_id, id_externo)` impõe no banco.
  const fitids = d.transacoes
    .filter((t) => t.idExterno !== undefined)
    .map((t) => `${t.contaId}\u0000${t.idExterno}`);
  if (repetido(fitids)) {
    throw new BackupInvalido('O backup tem lançamentos importados em duplicata.');
  }

  const contas = new Set(d.contas.map((c) => c.id));
  if (
    d.transacoes.some((t) => !contas.has(t.contaId)) ||
    d.metas.some((m) => !contas.has(m.contaId))
  ) {
    throw new BackupInvalido('O backup tem lançamentos de uma conta que não está nele.');
  }

  return d;
}
