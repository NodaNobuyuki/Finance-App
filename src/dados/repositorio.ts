import { EstadoPersistido } from './persistido';

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
   */
  salvar(antes: EstadoPersistido | null, depois: EstadoPersistido): Promise<void>;

  /** Zera o banco mantendo o esquema. */
  apagarTudo(): Promise<void>;

  fechar(): Promise<void>;
}
