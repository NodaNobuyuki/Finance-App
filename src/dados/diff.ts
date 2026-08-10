/**
 * Diferença entre duas versões de uma coleção, por id.
 *
 * Sem isto, gravar significaria reescrever a tabela inteira a cada toque —
 * aceitável com 14 lançamentos, inviável com dois anos de histórico. Com isto,
 * registrar um gasto escreve uma linha.
 *
 * Genérico de propósito: transações, metas, aportes e desafios têm o mesmo
 * formato de identidade, então é uma função só em vez de quatro variações
 * copiadas com um `id` trocado.
 */

export type Diferenca<T> = {
  inserir: T[];
  atualizar: T[];
  remover: string[];
};

export function diferencaPorId<T extends { id: string }>(antes: T[], depois: T[]): Diferenca<T> {
  const anteriores = new Map(antes.map((item) => [item.id, item]));
  const inserir: T[] = [];
  const atualizar: T[] = [];

  for (const item of depois) {
    const anterior = anteriores.get(item.id);
    if (!anterior) {
      inserir.push(item);
      // Comparação por referência de novo: o reducer copia o objeto quando
      // muda um campo, então quem sobreviveu intacto é o mesmo objeto.
    } else if (anterior !== item) {
      atualizar.push(item);
    }
    anteriores.delete(item.id);
  }

  return { inserir, atualizar, remover: [...anteriores.keys()] };
}

export function vazia<T>(d: Diferenca<T>): boolean {
  return d.inserir.length === 0 && d.atualizar.length === 0 && d.remover.length === 0;
}

/** Mesma ideia para coleção de strings sem identidade própria (dias). */
export function diferencaDeChaves(
  antes: readonly string[],
  depois: readonly string[],
): { inserir: string[]; remover: string[] } {
  const anteriores = new Set(antes);
  const atuais = new Set(depois);
  return {
    inserir: depois.filter((c) => !anteriores.has(c)),
    remover: antes.filter((c) => !atuais.has(c)),
  };
}
