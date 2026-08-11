import { categoriasIniciais } from '../dominio/categorias';
import { DiaISO } from '../dominio/datas';
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
  | 'categorias'
  | 'progressoDesafios'
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
  'categorias',
  'progressoDesafios',
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
    categorias: e.categorias,
    progressoDesafios: e.progressoDesafios,
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
 * O caminho inverso: junta o que veio do disco com o estado vazio.
 *
 * Mora aqui, junto do recorte, e não dentro de um repositório: é regra de
 * domínio, não de armazenamento. As duas implementações passam a mesma suíte de
 * contrato, então conserto aplicado só numa delas seria uma divergência
 * esperando para aparecer no aparelho de alguém.
 */
export function hidratar(vazio: Estado, salvo: EstadoPersistido, hoje: DiaISO): Estado {
  return {
    ...vazio,
    ...salvo,
    // `hoje` vem do relógio, nunca do disco — reabrir no dia gravado colocaria
    // o próximo lançamento na data errada.
    hoje,
    // Sem categoria nenhuma não dá para lançar. Só acontece em banco anterior à
    // v6, que criou a tabela sem preenchê-la: o catálogo de fábrica vive em
    // código em vez de repetido dentro de uma migration que nunca mais pode ser
    // editada. Apagar a última categoria de um tipo é proibido no reducer,
    // então "vazio" não tem outro significado possível.
    categorias: salvo.categorias.length > 0 ? salvo.categorias : categoriasIniciais(),
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
