import { Transacao } from '../dominio/tipos';
import { diferencaPorId } from './diff';
import { EstadoPersistido } from './persistido';
import { Recusa, RepositorioLocal } from './repositorio';

/**
 * Aplica o diff de transações sobre o que já está "em disco", com a mesma
 * restrição que o SQLite impõe: `(contaId, idExterno)` único quando houver
 * `idExterno`. Mesma ordem do SQL — remove primeiro, escreve depois —, e a
 * linha recusada fica como estava: ausente se era nova, versão antiga se era
 * atualização.
 */
function transacoesGravadas(
  disco: Transacao[],
  antes: Transacao[],
  depois: Transacao[],
  recusadas: Recusa[],
): Transacao[] {
  const linhas = new Map(disco.map((t) => [t.id, t]));
  const d = diferencaPorId(antes, depois);

  for (const id of d.remover) linhas.delete(id);

  for (const t of [...d.inserir, ...d.atualizar]) {
    const colide =
      t.idExterno !== undefined &&
      [...linhas.values()].some(
        (o) => o.id !== t.id && o.contaId === t.contaId && o.idExterno === t.idExterno,
      );
    if (colide) {
      recusadas.push({ tabela: 'transacoes', id: t.id });
      continue;
    }
    linhas.set(t.id, t);
  }

  return [...linhas.values()];
}

/**
 * Repositório em memória.
 *
 * Serve aos testes de tela e ao modo sem banco. Cumpre o mesmo contrato do
 * SQLite e passa a mesma suíte — por isso não é uma ficção conveniente que se
 * comporta diferente do que roda no aparelho. Inclusive nas restrições: linha
 * que o SQLite recusaria, esta também recusa.
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
    categorias: [...e.categorias],
    progressoDesafios: [...e.progressoDesafios],
    diasSemGasto: [...e.diasSemGasto],
    decisoesDeRecorrencia: [...e.decisoesDeRecorrencia],
  });

  return {
    async iniciar() {},
    async carregar() {
      return guardado === null ? null : copiar(guardado);
    },
    async salvar(antes, depois) {
      const recusadas: Recusa[] = [];
      const transacoes = transacoesGravadas(
        guardado?.transacoes ?? [],
        antes?.transacoes ?? [],
        depois.transacoes,
        recusadas,
      );
      guardado = copiar({ ...depois, transacoes });
      return { recusadas };
    },
    async apagarTudo() {
      guardado = null;
    },
    async fechar() {},
  };
}
