/**
 * Datas em ISO curto (`YYYY-MM-DD`), tratadas como string o tempo todo.
 *
 * Nada de `new Date()` espalhado pelo app: a data "de hoje" entra por
 * `AGORA`, que a store injeta. Isso mantém o protótipo determinístico e
 * deixa um único ponto para trocar pelo relógio real.
 */

export type DiaISO = string;

/** Âncora dos dados de demonstração. Trocar por `hojeReal()` liga o relógio. */
export const AGORA: DiaISO = '2026-08-05';

export function hojeReal(): DiaISO {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** Inicial do dia da semana, como aparece na trilha da semana: S T Q Q S S D. */
const LETRAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function partes(dia: DiaISO): { ano: number; mes: number; data: number } {
  const [ano, mes, data] = dia.split('-').map(Number);
  return { ano, mes, data };
}

/** Cria em UTC para que fuso horário nunca mova o dia. */
function paraUTC(dia: DiaISO): Date {
  const { ano, mes, data } = partes(dia);
  return new Date(Date.UTC(ano, mes - 1, data));
}

export function somarDias(dia: DiaISO, n: number): DiaISO {
  const d = paraUTC(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Dias inteiros de `de` até `ate`. Negativo quando `ate` já passou. */
export function diferencaEmDias(de: DiaISO, ate: DiaISO): number {
  return Math.round((paraUTC(ate).getTime() - paraUTC(de).getTime()) / 86_400_000);
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(dia: DiaISO): number {
  return paraUTC(dia).getUTCDay();
}

export function letraDoDia(dia: DiaISO): string {
  return LETRAS_SEMANA[diaDaSemana(dia)];
}

export function nomeDoDia(dia: DiaISO): string {
  return DIAS_SEMANA[diaDaSemana(dia)];
}

/** Segunda-feira da semana de `dia`. */
export function inicioDaSemana(dia: DiaISO): DiaISO {
  const dow = diaDaSemana(dia);
  const recuo = dow === 0 ? 6 : dow - 1;
  return somarDias(dia, -recuo);
}

export function diasDaSemana(inicio: DiaISO): DiaISO[] {
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
}

/** `"Hoje · 5 de agosto"`, `"Ontem · 4 de agosto"`, `"Segunda · 3 de agosto"`. */
export function rotuloDia(dia: DiaISO, hoje: DiaISO = AGORA): string {
  const { mes, data } = partes(dia);
  const dataLonga = `${data} de ${MESES[mes - 1]}`;
  if (dia === hoje) return `Hoje · ${dataLonga}`;
  if (dia === somarDias(hoje, -1)) return `Ontem · ${dataLonga}`;
  return `${nomeDoDia(dia)} · ${dataLonga}`;
}

/** Só a primeira metade do rótulo: "Hoje", "Ontem", "Segunda". */
export function rotuloCurto(dia: DiaISO, hoje: DiaISO = AGORA): string {
  return rotuloDia(dia, hoje).split(' · ')[0];
}

/** `"Agosto de 2026"`. */
export function rotuloMes(dia: DiaISO): string {
  const { ano, mes } = partes(dia);
  const nome = MESES[mes - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)} de ${ano}`;
}

/** `"Agosto 2026"`, para o seletor compacto do extrato. */
export function rotuloMesCurto(dia: DiaISO): string {
  const { ano, mes } = partes(dia);
  const nome = MESES[mes - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)} ${ano}`;
}

/** `"15 dez 2026"`, para prazo de meta. */
export function rotuloDataCurta(dia: DiaISO): string {
  const { ano, mes, data } = partes(dia);
  return `${data} ${MESES_CURTOS[mes - 1]} ${ano}`;
}

/** `"jun 2027"` — prazo longe o bastante para o dia não importar. */
export function rotuloMesAno(dia: DiaISO): string {
  const { ano, mes } = partes(dia);
  return `${MESES_CURTOS[mes - 1]} ${ano}`;
}

/** `"3/8"`, usado no histórico de semanas. */
export function rotuloDiaMes(dia: DiaISO): string {
  const { mes, data } = partes(dia);
  return `${data}/${mes}`;
}

/** `"3 a 9 de agosto"`, para o cabeçalho do resumo semanal. */
export function rotuloIntervalo(inicio: DiaISO, fim: DiaISO): string {
  const a = partes(inicio);
  const b = partes(fim);
  if (a.mes === b.mes) return `${a.data} a ${b.data} de ${MESES[b.mes - 1]}`;
  return `${a.data} de ${MESES[a.mes - 1]} a ${b.data} de ${MESES[b.mes - 1]}`;
}

export function mesDe(dia: DiaISO): string {
  return dia.slice(0, 7);
}

/** Primeiro dia do mês de `dia`. É a âncora do mês visível no Extrato. */
export function primeiroDoMes(dia: DiaISO): DiaISO {
  return `${mesDe(dia)}-01`;
}

/**
 * Soma meses, ancorando sempre no dia 1.
 *
 * Só faz sentido sobre `primeiroDoMes`: somar mês a um dia 31 teria de decidir
 * o que fazer com fevereiro, e essa pergunta não existe aqui.
 */
export function somarMeses(dia: DiaISO, n: number): DiaISO {
  const { ano, mes } = partes(dia);
  const total = ano * 12 + (mes - 1) + n;
  const novoMes = ((total % 12) + 12) % 12;
  const novoAno = (total - novoMes) / 12;
  return `${novoAno}-${String(novoMes + 1).padStart(2, '0')}-01`;
}

export function nomeDoMes(dia: DiaISO): string {
  return MESES[partes(dia).mes - 1];
}

export function mesCurto(dia: DiaISO): string {
  return MESES_CURTOS[partes(dia).mes - 1];
}

/** Dias do ritual semanal, na ordem em que aparecem no seletor. */
export const diasRitual = [
  { id: 'segunda', letra: 'Seg', nome: 'segunda-feira', prep: 'na', dow: 1 },
  { id: 'terca', letra: 'Ter', nome: 'terça-feira', prep: 'na', dow: 2 },
  { id: 'quarta', letra: 'Qua', nome: 'quarta-feira', prep: 'na', dow: 3 },
  { id: 'quinta', letra: 'Qui', nome: 'quinta-feira', prep: 'na', dow: 4 },
  { id: 'sexta', letra: 'Sex', nome: 'sexta-feira', prep: 'na', dow: 5 },
  { id: 'sabado', letra: 'Sáb', nome: 'sábado', prep: 'no', dow: 6 },
  { id: 'domingo', letra: 'Dom', nome: 'domingo', prep: 'no', dow: 0 },
] as const;

export type DiaRitualId = (typeof diasRitual)[number]['id'];
