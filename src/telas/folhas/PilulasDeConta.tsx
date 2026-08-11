import React from 'react';
import { View } from 'react-native';
import { Toque, Txt } from '../../componentes/basicos';
import { Conta } from '../../dominio/tipos';
import { useTema } from '../../tema/TemaContext';

/**
 * Escolha de conta em pílulas, com a linha que explica o que vai acontecer com
 * o saldo.
 *
 * Toda folha de transferência precisa disso — guardar, retirar e transferir
 * entre contas —, e a nota importa tanto quanto a escolha: o saldo vai se mexer
 * de verdade, e a pessoa tem de saber em qual conta antes de confirmar.
 */
export function PilulasDeConta({
  rotulo,
  contas,
  selecionada,
  aoEscolher,
  nota,
  desabilitada,
}: {
  rotulo: string;
  contas: Conta[];
  selecionada: string;
  aoEscolher: (contaId: string) => void;
  nota?: string;
  /** Conta que não pode ser escolhida — a outra ponta da transferência. */
  desabilitada?: string;
}) {
  const { t } = useTema();

  return (
    <View style={{ gap: 9 }}>
      <Txt tamanho={11} peso={600} cor={t.inkMuted} alinhamento="center" espacamento={0.5}>
        {rotulo}
      </Txt>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
        {contas.map((c) => {
          const ativa = c.id === selecionada;
          const bloqueada = c.id === desabilitada;
          return (
            <Toque
              key={c.id}
              aoTocar={() => (bloqueada ? undefined : aoEscolher(c.id))}
              rotuloAcessivel={`${rotulo}: ${c.nome}`}
            >
              <View
                style={{
                  borderRadius: 999,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  opacity: bloqueada ? 0.35 : 1,
                  borderColor: ativa ? t.accent : t.lineInput,
                  backgroundColor: ativa ? t.accent : t.surface,
                }}
              >
                <Txt tamanho={12.5} peso={600} cor={ativa ? t.onAccent : t.inkMuted}>
                  {c.nome}
                </Txt>
              </View>
            </Toque>
          );
        })}
      </View>

      {nota ? (
        <Txt tamanho={11.5} cor={t.inkFaint} alinhamento="center" entrelinha={1.45}>
          {nota}
        </Txt>
      ) : null}
    </View>
  );
}
