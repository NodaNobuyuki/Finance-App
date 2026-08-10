import { EstadoPersistido } from './persistido';
import { RepositorioLocal } from './repositorio';

/**
 * Repositório em memória.
 *
 * Serve aos testes de tela e ao modo sem banco. Cumpre o mesmo contrato do
 * SQLite e passa a mesma suíte — por isso não é uma ficção conveniente que se
 * comporta diferente do que roda no aparelho.
 *
 * Guarda uma cópia rasa das coleções: sem isso, quem chamasse `carregar()`
 * receberia os mesmos arrays que o estado vivo, e uma mutação acidental lá
 * fora "corromperia o banco" de um jeito que o SQLite jamais permitiria.
 */
export function criarRepositorioMemoria(): RepositorioLocal {
  let guardado: EstadoPersistido | null = null;

  const copiar = (e: EstadoPersistido): EstadoPersistido => ({
    ...e,
    transacoes: [...e.transacoes],
    contas: [...e.contas],
    metas: [...e.metas],
    aportes: [...e.aportes],
    progressoDesafios: [...e.progressoDesafios],
    historicoSemanas: [...e.historicoSemanas],
    diasSemGasto: [...e.diasSemGasto],
    contexto: { ...e.contexto },
  });

  return {
    async iniciar() {},
    async carregar() {
      return guardado === null ? null : copiar(guardado);
    },
    async salvar(_antes, depois) {
      guardado = copiar(depois);
    },
    async apagarTudo() {
      guardado = null;
    },
    async fechar() {},
  };
}
