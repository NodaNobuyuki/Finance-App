/**
 * Erros tipados.
 *
 * `throw new Error('deu ruim')` obriga quem captura a comparar string de
 * mensagem para decidir o que fazer. A distinção que importa aqui é uma só:
 *
 *   ErroDeDominio — regra do produto foi violada. É explicável ao usuário e
 *                   repetir a operação não muda nada.
 *   ErroDeInfra   — o mundo falhou: disco cheio, banco travado, migração
 *                   quebrada. Não é explicável, mas costuma valer tentar de novo.
 *
 * A diferença decide a interface: domínio vira mensagem, infra vira "tentar de
 * novo" e log. Sem isso, persistência transforma qualquer falha de disco num
 * crash indistinguível de bug de regra.
 */

export abstract class ErroDoApp extends Error {
  /** Estável, para log e telemetria — a mensagem pode mudar, o código não. */
  readonly codigo: string;
  /** O erro original, quando este embrulha outro. */
  readonly causa?: unknown;

  constructor(codigo: string, mensagem: string, causa?: unknown) {
    super(mensagem);
    this.codigo = codigo;
    this.causa = causa;
    this.name = new.target.name;
    // Babel pode transpilar `extends Error` de um jeito que quebra o
    // `instanceof`. Sem esta linha, todo `catch` tipado falha em silêncio.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Regra do produto violada. Tentar de novo com a mesma entrada dá no mesmo. */
export class ErroDeDominio extends ErroDoApp {}

/** Falha do mundo — disco, banco, migração. Costuma valer retentar. */
export class ErroDeInfra extends ErroDoApp {}

/* ── Domínio ─────────────────────────────────────────────────── */

export class MetaDesconhecida extends ErroDeDominio {
  constructor(readonly metaId: string) {
    super('meta-desconhecida', `Meta não encontrada: ${metaId}`);
  }
}

export class ValorInvalido extends ErroDeDominio {
  constructor(readonly valorCentavos: number) {
    super('valor-invalido', `Valor precisa ser inteiro positivo em centavos: ${valorCentavos}`);
  }
}

/* ── Infra ───────────────────────────────────────────────────── */

export class BancoIndisponivel extends ErroDeInfra {
  constructor(causa?: unknown) {
    super('banco-indisponivel', 'Não foi possível abrir o banco local.', causa);
  }
}

export class MigracaoFalhou extends ErroDeInfra {
  constructor(
    readonly versao: number,
    readonly nomeDaMigracao: string,
    causa?: unknown,
  ) {
    super(
      'migracao-falhou',
      `Migração v${versao} (${nomeDaMigracao}) falhou. O banco ficou na versão anterior.`,
      causa,
    );
  }
}

export class LeituraFalhou extends ErroDeInfra {
  constructor(
    readonly alvo: string,
    causa?: unknown,
  ) {
    super('leitura-falhou', `Falha ao ler ${alvo} do banco local.`, causa);
  }
}

export class EscritaFalhou extends ErroDeInfra {
  constructor(
    readonly alvo: string,
    causa?: unknown,
  ) {
    super('escrita-falhou', `Falha ao gravar ${alvo} no banco local.`, causa);
  }
}

/** Texto curto para o usuário. Infra nunca expõe detalhe técnico. */
export function mensagemParaOUsuario(erro: unknown): string {
  if (erro instanceof ErroDeDominio) return erro.message;
  if (erro instanceof ErroDeInfra) return 'Não deu para salvar agora. Vamos tentar de novo.';
  return 'Algo deu errado.';
}
