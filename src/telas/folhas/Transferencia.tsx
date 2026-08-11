import React from 'react';
import { View } from 'react-native';
import { BotaoPrincipal, Txt } from '../../componentes/basicos';
import { Teclado } from '../../componentes/Teclado';
import { deDigitos, formatar } from '../../dominio/dinheiro';
import { saldoDaConta } from '../../dominio/saldo';
import { useLoja } from '../../estado/store';
import { useTema } from '../../tema/TemaContext';
import { Folha } from './Folha';
import { PilulasDeConta } from './PilulasDeConta';

/**
 * Mover dinheiro entre duas contas suas — pagar a fatura do cartão, tirar da
 * poupança, acertar a carteira.
 *
 * É a mesma mecânica do aporte sem meta envolvida: par de transações com o
 * mesmo `transferenciaId`, que move saldo e não conta como gasto nem ganho.
 */
export function Transferencia() {
  const { estado, despachar } = useLoja();
  const { t } = useTema();

  const valor = deDigitos(estado.rascunho.digitos);
  const origem = estado.contas.find((c) => c.id === estado.rascunho.contaId);
  const destino = estado.contas.find((c) => c.id === estado.transferenciaDestinoId);

  const saldoOrigem = origem ? saldoDaConta(origem, estado.transacoes) : 0;
  const podeConfirmar =
    valor > 0 && origem !== undefined && destino !== undefined && origem.id !== destino.id;

  return (
    <Folha titulo="Transferir" aoFechar={() => despachar({ tipo: 'FECHAR_FOLHA' })}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 20, paddingHorizontal: 16 }}>
        <View style={{ alignItems: 'center', gap: 5 }}>
          <Txt
            tamanho={42}
            peso={600}
            numerico
            entrelinha={1.1}
            espacamento={-0.84}
            cor={valor === 0 ? t.inkFaint : t.ink}
          >
            {formatar(valor)}
          </Txt>
          <Txt tamanho={11.5} cor={t.inkFaint} alinhamento="center" entrelinha={1.45}>
            {origem ? `${origem.nome} tem ${formatar(saldoOrigem)}` : ''}
          </Txt>
        </View>

        <PilulasDeConta
          rotulo="DE"
          contas={estado.contas}
          selecionada={estado.rascunho.contaId}
          aoEscolher={(contaId) => despachar({ tipo: 'RASCUNHO_CONTA', contaId })}
          desabilitada={estado.transferenciaDestinoId}
        />

        <PilulasDeConta
          rotulo="PARA"
          contas={estado.contas}
          selecionada={estado.transferenciaDestinoId}
          aoEscolher={(contaId) => despachar({ tipo: 'TRANSFERENCIA_DESTINO', contaId })}
          desabilitada={estado.rascunho.contaId}
          nota={
            // Transferir não é gasto: o patrimônio não muda, só o lugar onde o
            // dinheiro está. Dizer isso evita a leitura de que "sumiu".
            podeConfirmar
              ? 'Seu patrimônio não muda — o dinheiro só troca de conta.'
              : 'Escolha duas contas diferentes.'
          }
        />
      </View>

      <View
        style={{
          backgroundColor: t.surface,
          borderTopWidth: 1,
          borderTopColor: t.line,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 12,
          gap: 9,
        }}
      >
        <Teclado
          aoDigitar={(digito) => despachar({ tipo: 'DIGITO', valor: digito })}
          aoApagar={() => despachar({ tipo: 'APAGAR_DIGITO' })}
        />
        <BotaoPrincipal
          rotulo={valor === 0 ? 'Informe um valor' : `Transferir ${formatar(valor)}`}
          fundo={podeConfirmar ? t.accent : t.lineInput}
          desabilitado={!podeConfirmar}
          aoTocar={() => despachar({ tipo: 'CONFIRMAR_TRANSFERENCIA' })}
        />
      </View>
    </Folha>
  );
}
