import { Estado } from '../estado/store';

/**
 * O recorte de `Estado` que sobrevive a fechar o app.
 *
 * O que fica de fora é tão importante quanto o que entra: `tela`, `folha`,
 * `rascunho`, `toast`, `filtro*` e `hoje` são estado de sessão. Gravar `tela`
 * faria o app reabrir no meio de um fluxo; gravar `hoje` reabriria no dia
 * errado — é o relógio que manda nele, não o disco.
 */
export type EstadoPersistido = Pick<
  Estado,
  | 'perfil'
  | 'transacoes'
  | 'contas'
  | 'metas'
  | 'aportes'
  | 'progressoDesafios'
  | 'historicoSemanas'
  | 'diasSemGasto'
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

export const CHAVES_PERSISTIDAS = [
  'perfil',
  'transacoes',
  'contas',
  'metas',
  'aportes',
  'progressoDesafios',
  'historicoSemanas',
  'diasSemGasto',
  'orcamentoMensalCentavos',
  'contexto',
  'onboardingConcluido',
  'metaSemanal',
  'ritualDiaFechamento',
  'ritualPrimeira',
  'lembrete',
  'semanaFechada',
  'intencao',
  'mostrarSaldo',
] as const satisfies readonly (keyof EstadoPersistido)[];

export function recortePersistido(e: Estado): EstadoPersistido {
  return {
    perfil: e.perfil,
    transacoes: e.transacoes,
    contas: e.contas,
    metas: e.metas,
    aportes: e.aportes,
    progressoDesafios: e.progressoDesafios,
    historicoSemanas: e.historicoSemanas,
    diasSemGasto: e.diasSemGasto,
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

/**
 * Mudou alguma coisa que precisa ir para o disco?
 *
 * Comparação por referência, O(1): o reducer é imutável, então coleção que não
 * mudou é literalmente o mesmo array. É isso que faz digitar no teclado
 * numérico — que troca `rascunho` a cada toque — não encostar no banco.
 */
export function mudouAlgoPersistido(antes: EstadoPersistido, depois: EstadoPersistido): boolean {
  return CHAVES_PERSISTIDAS.some((chave) => antes[chave] !== depois[chave]);
}
