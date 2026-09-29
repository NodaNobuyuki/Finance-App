import { hex, token, CorRef } from '../tema/paletas';
import { icones } from './categorias';
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

type BaseDesafio = {
  id: string;
  nome: string;
  /** Subtítulo quando o desafio ainda é opcional (não foi aceito). */
  subOff: string;
  unidade: string;
  acao: string;
  /** Já vem aceito de fábrica — quem instala hoje encontra este ativo. */
  aceitoPorPadrao: boolean;
  /**
   * Desenho e cor são do desafio, não emprestados de uma categoria.
   *
   * Eram `categoriaId: 'restaurante'`, `'contas'`, `'salario'`… — ids de
   * fábrica resolvidos contra as categorias DA PESSOA. Quem apagava ou nunca
   * teve "Restaurante" via o ícone do buraco no desafio. Desafio é conteúdo
   * nosso, categoria é vocabulário dela: um não pode depender do outro.
   */
  icone: string;
  cor: CorRef;
  /** Quanto o desafio evita de gasto, em centavos. */
  economiaCentavos: Centavos;
};

/**
 * Como o progresso é medido — e é isto que decide o que o catálogo PODE dizer.
 *
 * Medida derivada não tem alvo nem subtítulo no catálogo: os dois saem do
 * estado em `desafios()`. Era aí que o catálogo mentia — "Registrar 4 vezes"
 * para quem escolheu 6 no ritual, "2 lançamentos sem categoria" para todo
 * mundo, "a semana fecha domingo" para quem fecha no sábado.
 */
export type DefinicaoDesafio =
  /** Registros da semana contra `metaSemanal`. Tocar abre o lançamento. */
  | (BaseDesafio & { medida: 'registros' })
  /** Lançamentos do mês com categoria que existe, contra todos do mês. */
  | (BaseDesafio & { medida: 'categorizados' })
  /** Quem avança é o toque da pessoa; alvo e subtítulo são do catálogo. */
  | (BaseDesafio & { medida: 'manual'; alvo: number; sub: string });

export const definicoesDesafios: DefinicaoDesafio[] = [
  {
    id: 'reg4',
    medida: 'registros',
    nome: 'Bater a meta de registros da semana',
    subOff: '',
    unidade: 'registros',
    acao: 'Registrar agora',
    aceitoPorPadrao: true,
    icone: icones.calendarioOk,
    cor: token('up'),
    economiaCentavos: 0,
  },
  {
    id: 'catg',
    medida: 'categorizados',
    nome: 'Categorizar tudo do mês',
    subOff: '',
    unidade: 'lançamentos',
    acao: 'Revisar no Extrato',
    aceitoPorPadrao: true,
    icone: icones.lapis,
    cor: hex('#8a6d3b'),
    economiaCentavos: 0,
  },
  // Os subtítulos dos manuais não prometem prazo ("termina sexta", "termina no
  // fim da semana"): o progresso não guarda quando começou, então prazo
  // nenhum é verdade. Nem números em R$ "do mês passado" — eram da demo.
  {
    id: 'assin',
    medida: 'manual',
    nome: 'Revisar 3 assinaturas',
    sub: 'uma por vez: ainda vale o que custa?',
    subOff: '',
    alvo: 3,
    unidade: 'assinaturas',
    acao: 'Revisei 1',
    aceitoPorPadrao: true,
    icone: icones.repetir,
    cor: hex('#4a5f8a'),
    economiaCentavos: 0,
  },
  {
    id: 'delivery',
    medida: 'manual',
    nome: 'Semana sem delivery',
    sub: 'marque cada dia sem pedir comida',
    subOff: 'opcional · 7 dias sem pedir comida',
    alvo: 7,
    unidade: 'dias',
    acao: 'Marcar hoje',
    aceitoPorPadrao: false,
    icone: icones.talheres,
    cor: hex('#c0562b'),
    economiaCentavos: 31200,
  },
  {
    id: 'cafe',
    medida: 'manual',
    nome: '5 dias sem café fora',
    sub: 'marque cada dia sem café fora',
    subOff: 'opcional · um cafezinho a menos por dia',
    alvo: 5,
    unidade: 'dias',
    acao: 'Marcar hoje',
    aceitoPorPadrao: false,
    icone: icones.talheres,
    cor: hex('#c0562b'),
    economiaCentavos: 6000,
  },
  {
    id: 'uber',
    medida: 'manual',
    nome: 'Semana sem app de transporte',
    sub: 'marque cada dia sem corrida por app',
    subOff: 'opcional · 7 dias sem corrida por app',
    alvo: 7,
    unidade: 'dias',
    acao: 'Marcar hoje',
    aceitoPorPadrao: false,
    icone: icones.carro,
    cor: hex('#2f6f8f'),
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
