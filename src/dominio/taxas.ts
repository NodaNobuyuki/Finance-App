import { Taxa } from './tipos';

/**
 * Catálogo de taxas do simulador. É referência, não dado do usuário: não entra
 * no estado nem é persistido — muda com o mercado, não com quem usa o app.
 */
export const taxas: Taxa[] = [
  { id: 'poupanca', nome: 'Poupança', bpsMensal: 60, rotulo: '0,6% a.m.' },
  { id: 'cdi', nome: 'CDI 100%', bpsMensal: 88, rotulo: '0,88% a.m.' },
  { id: 'cdi2', nome: 'CDI + 2%', bpsMensal: 105, rotulo: '1,05% a.m.' },
];

export const TAXA_PADRAO = 'cdi';

/** Nunca lança: taxa desconhecida cai no padrão em vez de derrubar a tela. */
export function taxa(id: string): Taxa {
  return taxas.find((t) => t.id === id) ?? taxas.find((t) => t.id === TAXA_PADRAO)!;
}
