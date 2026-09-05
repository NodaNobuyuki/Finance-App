import React from 'react';
import { View } from 'react-native';
import { Toque, Txt } from '../../componentes/basicos';
import { Conta } from '../../dominio/tipos';
import { useTema } from '../../tema/TemaContext';

/**
 * Escolha em pílulas, com a linha que explica o que vai acontecer.
 *
 * A nota importa tanto quanto a escolha: dinheiro vai se mexer de verdade, e a
 * pessoa tem de saber para onde antes de confirmar.
 */
export function Pilulas<T extends { id: string; nome: string }>({
  rotulo,
  itens,
  selecionado,
  aoEscolher,
  nota,
  desabilitado,
}: {
  rotulo: string;
  itens: T[];
  selecionado: string | null;
  aoEscolher: (id: string) => void;
  nota?: string;
  /** Item que não pode ser escolhido — a outra ponta da transferência. */
  desabilitado?: string;
}) {
  const { t } = useTema();

  return (
    <View style={{ gap: 9 }}>
      <Txt tamanho={11} peso={600} cor={t.inkMuted} alinhamento="center" espacamento={0.5}>
        {rotulo}
      </Txt>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
        {itens.map((item) => {
          const ativa = item.id === selecionado;
          const bloqueada = item.id === desabilitado;
          return (
            <Toque
              key={item.id}
              aoTocar={() => (bloqueada ? undefined : aoEscolher(item.id))}
              rotuloAcessivel={`${rotulo}: ${item.nome}`}
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
                  {item.nome}
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

/**
 * A escolha de conta que as três folhas de transferência compartilham —
 * guardar, retirar e transferir entre contas.
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
  desabilitada?: string;
}) {
  return (
    <Pilulas
      rotulo={rotulo}
      itens={contas}
      selecionado={selecionada}
      aoEscolher={aoEscolher}
      nota={nota}
      desabilitado={desabilitada}
    />
  );
}
