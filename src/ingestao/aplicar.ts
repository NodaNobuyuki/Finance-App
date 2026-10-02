import { CATEGORIA_TRANSFERENCIA } from '../dominio/categorias';
import { DiaISO } from '../dominio/datas';
import { Conta, Transacao } from '../dominio/tipos';
import { Previa } from './previa';

export type ResumoDaImportacao = {
  /**
   * Linhas DO ARQUIVO que entraram. A outra ponta criada por transferência não
   * conta: a pessoa reconhece o número de linhas do extrato que baixou, e a
   * ponta já aparece em `transferencias`.
   */
  importadas: number;
  /** Duplicatas confirmadas: não entraram, e a existente ganhou o FITID. */
  ligadas: number;
  transferencias: number;
  /** Das importadas, quantas ficaram sem categoria — o que sobra para a pessoa fazer. */
  semCategoria: number;
  /** O dia mais recente que a importação tocou, para o Extrato abrir nele. */
  ultimoDia: DiaISO | null;
};

/**
 * Transforma a prévia confirmada em lançamentos.
 *
 * Puro, com id e relógio injetados — as mesmas duas fontes de não-determinismo
 * do reducer, que é quem chama isto.
 *
 * Três escritas além de criar linha:
 * - duplicata confirmada passa o FITID à linha existente, para a próxima
 *   importação do mesmo período reconhecê-la sem perguntar de novo;
 * - transferência cria as duas pontas com o mesmo `transferenciaId`, como a
 *   folha "Transferir" — e a ponta que já existia na outra conta (o boleto
 *   importado antes) vira ponta em vez de ganhar uma gêmea;
 * - linha importada guarda o texto do banco em `descricaoOriginal`, sempre.
 */
export function aplicarImportacao(
  previa: Previa,
  contaId: string,
  e: { transacoes: Transacao[]; contas: Conta[] },
  d: { gerarId: () => string; agoraMs: () => number },
): { transacoes: Transacao[]; resumo: ResumoDaImportacao } {
  const alteradas = new Map<string, Transacao>();
  const novas: Transacao[] = [];
  const resumo: ResumoDaImportacao = {
    importadas: 0,
    ligadas: 0,
    transferencias: 0,
    semCategoria: 0,
    ultimoDia: null,
  };
  const nome = (id: string) => e.contas.find((c) => c.id === id)?.nome ?? 'Conta';

  for (const linha of previa.linhas) {
    const { bruta } = linha;
    if (!resumo.ultimoDia || bruta.ocorridoEm > resumo.ultimoDia) {
      resumo.ultimoDia = bruta.ocorridoEm;
    }
    const importada = (campos: Pick<Transacao, 'categoriaId' | 'descricao'>): Transacao => ({
      id: d.gerarId(),
      contaId,
      valorCentavos: bruta.valorCentavos,
      ocorridoEm: bruta.ocorridoEm,
      descricaoOriginal: bruta.descricaoOriginal,
      idExterno: bruta.idExterno,
      origem: bruta.origem,
      criadoEm: d.agoraMs(),
      ...campos,
    });

    if (linha.situacao === 'duplicata' && linha.mesma) {
      alteradas.set(linha.existente.id, { ...linha.existente, idExterno: bruta.idExterno });
      resumo.ligadas += 1;
      continue;
    }

    if (linha.situacao !== 'transferencia') {
      novas.push(importada({ categoriaId: linha.categoriaId, descricao: bruta.descricaoOriginal }));
      resumo.importadas += 1;
      if (linha.categoriaId === '') resumo.semCategoria += 1;
      continue;
    }

    const transferenciaId = d.gerarId();
    const [origemId, destinoId] =
      bruta.valorCentavos < 0 ? [contaId, linha.contraparteId] : [linha.contraparteId, contaId];
    const ponta = {
      categoriaId: CATEGORIA_TRANSFERENCIA,
      descricao: `${nome(origemId)} → ${nome(destinoId)}`,
    };

    novas.push({ ...importada(ponta), transferenciaId });
    if (linha.casaCom) {
      alteradas.set(linha.casaCom.id, { ...linha.casaCom, ...ponta, transferenciaId });
    } else {
      // A outra ponta não veio de arquivo nenhum: nasce sem FITID, e é por isso
      // que o extrato da outra conta, quando chegar, a reconhece como
      // possível duplicata em vez de criar uma terceira linha.
      novas.push({
        id: d.gerarId(),
        contaId: linha.contraparteId,
        valorCentavos: -bruta.valorCentavos,
        ocorridoEm: bruta.ocorridoEm,
        descricaoOriginal: bruta.descricaoOriginal,
        origem: bruta.origem,
        criadoEm: d.agoraMs(),
        transferenciaId,
        ...ponta,
      });
    }
    resumo.importadas += 1;
    resumo.transferencias += 1;
  }

  return {
    transacoes: [...novas, ...e.transacoes.map((t) => alteradas.get(t.id) ?? t)],
    resumo,
  };
}
