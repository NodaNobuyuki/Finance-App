import { Centavos } from './dinheiro';
import { ProgressoDesafio } from './tipos';

/**
 * Catálogo de desafios.
 *
 * A DEFINIÇÃO (nome, alvo, unidade, ação) é catálogo: vem no app, igual para
 * todo mundo, como `categorias` e `taxas`. Só o que é do usuário — se ele
 * entrou e quanto andou — mora no `Estado` e vai para o banco.
 *
 * Isso não desfaz a mudança que tirou os desafios de constante de módulo: o
 * problema lá era progresso viver num contador paralelo a dado imutável. Aqui
 * a divisão é a mesma de categoria × transação — o que é catálogo fica no
 * código, o que é do usuário referencia por id.
 *
 * O motivo é atualização: com a definição gravada no banco de cada pessoa, um
 * desafio novo publicado numa v2 NUNCA apareceria para quem já instalou — o
 * app carregaria a lista do disco dela. Do jeito que está, desafio novo entra
 * para todo mundo, já com o padrão certo, e o progresso de quem existe
 * continua intacto.
 */

export type DefinicaoDesafio = {
  id: string;
  nome: string;
  sub: string;
  /** Subtítulo quando o desafio ainda é opcional (não foi aceito). */
  subOff: string;
  alvo: number;
  unidade: string;
  acao: string;
  /** Progresso vem dos registros da semana, não de toque manual. */
  automatico?: boolean;
  /** Já vem aceito de fábrica — quem instala hoje encontra este ativo. */
  aceitoPorPadrao: boolean;
  categoriaId: string;
  /** Quanto o desafio evita de gasto, em centavos. */
  economiaCentavos: Centavos;
};

export const definicoesDesafios: DefinicaoDesafio[] = [
  {
    id: 'reg4',
    nome: 'Registrar 4 vezes nesta semana',
    sub: 'a semana fecha domingo',
    subOff: '',
    alvo: 4,
    unidade: 'registros',
    acao: 'Registrar agora',
    automatico: true,
    aceitoPorPadrao: true,
    categoriaId: 'salario',
    economiaCentavos: 0,
  },
  {
    id: 'catg',
    nome: 'Categorizar tudo do mês',
    sub: '2 lançamentos sem categoria',
    subOff: '',
    alvo: 14,
    unidade: 'lançamentos',
    acao: 'Revisar 1',
    aceitoPorPadrao: true,
    categoriaId: 'contas',
    economiaCentavos: 0,
  },
  {
    id: 'assin',
    nome: 'Revisar as assinaturas',
    sub: '3 assinaturas ativas',
    subOff: '',
    alvo: 3,
    unidade: 'assinaturas',
    acao: 'Revisar 1',
    aceitoPorPadrao: true,
    categoriaId: 'assinaturas',
    economiaCentavos: 0,
  },
  {
    id: 'delivery',
    nome: 'Semana sem delivery',
    sub: 'termina no fim da semana',
    subOff: 'opcional · R$ 312 no mês passado',
    alvo: 7,
    unidade: 'dias',
    acao: 'Marcar hoje',
    aceitoPorPadrao: false,
    categoriaId: 'restaurante',
    economiaCentavos: 31200,
  },
  {
    id: 'cafe',
    nome: '5 dias sem café fora',
    sub: 'termina sexta',
    subOff: 'opcional · R$ 12 por dia',
    alvo: 5,
    unidade: 'dias',
    acao: 'Marcar hoje',
    aceitoPorPadrao: false,
    categoriaId: 'restaurante',
    economiaCentavos: 6000,
  },
  {
    id: 'uber',
    nome: 'Semana sem app de transporte',
    sub: 'termina no fim da semana',
    subOff: 'opcional · R$ 244 no mês passado',
    alvo: 7,
    unidade: 'dias',
    acao: 'Marcar hoje',
    aceitoPorPadrao: false,
    categoriaId: 'transporte',
    economiaCentavos: 24400,
  },
];

/**
 * O progresso de quem usa o app, com o padrão do catálogo quando ainda não há
 * linha gravada. É esta função que faz desafio recém-publicado aparecer.
 */
export function progressoDe(
  definicao: DefinicaoDesafio,
  progressos: ProgressoDesafio[],
): ProgressoDesafio {
  return (
    progressos.find((p) => p.id === definicao.id) ?? {
      id: definicao.id,
      aceito: definicao.aceitoPorPadrao,
      progresso: 0,
    }
  );
}
