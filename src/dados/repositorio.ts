import { EstadoPersistido } from './persistido';

/** Linha que o banco recusou por violar uma restrição do esquema. */
export type Recusa = { tabela: string; id: string };

export type Gravacao = {
  /**
   * O que ficou fora do disco. Vazio no caminho normal.
   *
   * A recusa é por linha: o resto da gravação entra. Quando uma linha ruim
   * derrubava a gravação inteira, o reenvio levava a mesma linha de novo e
   * batia na mesma restrição — nenhuma escrita chegava mais ao disco, e tudo o
   * que a pessoa fizesse dali em diante sumia ao fechar o app.
   */
  recusadas: Recusa[];
};

/**
 * O contrato de persistência local.
 *
 * Duas implementações o cumprem — SQLite e memória — e a mesma suíte de testes
 * roda contra as duas. É isso que dá o direito de usar a de memória nos testes
 * de tela sem que ela vire uma ficção que se comporta diferente do banco real.
 */
export interface RepositorioLocal {
  /** Abre o banco e aplica as migrations pendentes. Idempotente. */
  iniciar(): Promise<void>;

  /** `null` quando nunca houve gravação — é o sinal de primeiro uso. */
  carregar(): Promise<EstadoPersistido | null>;

  /**
   * Grava o que mudou de `antes` para `depois`.
   *
   * Recebe os dois lados porque o diff é por identidade: assim uma escrita
   * custa as linhas que mudaram, não a tabela inteira. `antes` é `null` no
   * primeiro salvamento, que grava tudo.
   *
   * Lança só quando o mundo falha (disco, banco) — aí nada foi gravado e vale
   * reenviar. Restrição violada não lança: volta em `recusadas`.
   */
  salvar(antes: EstadoPersistido | null, depois: EstadoPersistido): Promise<Gravacao>;

  /** Zera o banco mantendo o esquema. */
  apagarTudo(): Promise<void>;

  fechar(): Promise<void>;
}
