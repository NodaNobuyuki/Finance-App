import React from 'react';
import { View } from 'react-native';
import { Txt } from '../../componentes/basicos';
import { rotuloDia } from '../../dominio/datas';
import { formatar } from '../../dominio/dinheiro';
import { useRecorte, useDespachar } from '../../estado/store';
import { useTema } from '../../tema/TemaContext';
import { BotaoApagar } from './Campo';
import { Folha } from './Folha';

/** O que esta tela lê do estado — e só isto a acorda. */
const CHAVES = ['transacoes', 'contas', 'hoje'] as const;

/**
 * As duas pontas de um movimento entre contas — transferência, guardar ou
 * retirar de meta.
 *
 * Não é a folha de edição de propósito: editar uma ponta sozinha quebraria o
 * par, e editar as duas juntas seria refazer a folha de origem com outra cara.
 * O que sobra para fazer com um movimento errado é apagá-lo e lançar de novo.
 */
export function DetalheTransferencia({ transferenciaId }: { transferenciaId: string }) {
  const estado = useRecorte(CHAVES);
  const despachar = useDespachar();
  const { t } = useTema();

  const par = estado.transacoes.filter((x) => x.transferenciaId === transferenciaId);
  const saida = par.find((x) => x.valorCentavos < 0);
  const entrada = par.find((x) => x.valorCentavos > 0);
  if (!saida || !entrada) return null;

  const nome = (contaId: string) => estado.contas.find((c) => c.id === contaId)?.nome ?? '—';
  const trajeto =
    saida.contaId === entrada.contaId
      ? `Em ${nome(saida.contaId)}`
      : `De ${nome(saida.contaId)} para ${nome(entrada.contaId)}`;

  return (
    <Folha titulo="Movimento" aoFechar={() => despachar({ tipo: 'FECHAR_FOLHA' })}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 22, paddingHorizontal: 22 }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Txt tamanho={15} peso={600} alinhamento="center">
            {saida.descricao}
          </Txt>
          <Txt tamanho={42} peso={600} numerico entrelinha={1.1} espacamento={-0.84}>
            {formatar(entrada.valorCentavos)}
          </Txt>
          <Txt tamanho={12.5} cor={t.inkMuted} alinhamento="center">
            {trajeto}
          </Txt>
          <Txt tamanho={12.5} cor={t.inkFaint} alinhamento="center">
            {rotuloDia(saida.ocorridoEm, estado.hoje)}
          </Txt>
        </View>

        <Txt tamanho={11.5} cor={t.inkFaint} alinhamento="center" entrelinha={1.45}>
          Dinheiro mudando de lugar não é gasto nem ganho. Para corrigir valor ou data, apague e
          faça o movimento de novo.
        </Txt>

        <BotaoApagar
          rotulo="Apagar movimento"
          aoTocar={() => despachar({ tipo: 'APAGAR_TRANSACAO', transacaoId: saida.id })}
        />
      </View>
    </Folha>
  );
}
