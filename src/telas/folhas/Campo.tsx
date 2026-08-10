import React from 'react';
import { TextInput, View } from 'react-native';
import { Rotulo, Toque, Txt } from '../../componentes/basicos';
import { Icone } from '../../componentes/Icone';
import { icones } from '../../dominio/categorias';
import { sans } from '../../tema/fontes';
import { useTema } from '../../tema/TemaContext';

/**
 * Peças de formulário compartilhadas pelas folhas de cadastro.
 *
 * Moram aqui porque conta e meta pedem exatamente os mesmos controles. O
 * onboarding tem cópias próprias e continua assim de propósito: lá o campo faz
 * parte de um fluxo de 3 passos com layout próprio, e unificar os dois
 * arrastaria a folha para dentro de decisões que só o primeiro uso tem.
 */

export function CampoTexto({
  rotulo,
  valor,
  aoMudar,
  placeholder,
  autoFoco = false,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (texto: string) => void;
  placeholder: string;
  autoFoco?: boolean;
}) {
  const { t } = useTema();
  return (
    <View style={{ gap: 9 }}>
      <Rotulo>{rotulo}</Rotulo>
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        placeholder={placeholder}
        placeholderTextColor={t.inkFaint}
        autoFocus={autoFoco}
        accessibilityLabel={rotulo}
        style={[
          sans(500),
          {
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.lineInput,
            borderRadius: 12,
            paddingVertical: 13,
            paddingHorizontal: 14,
            fontSize: 15,
            color: t.ink,
          },
        ]}
      />
    </View>
  );
}

/** Pílulas de escolha única — tipo de conta, prazo da meta. */
export function Opcoes<T extends string>({
  rotulo,
  opcoes,
  selecionada,
  aoEscolher,
}: {
  rotulo: string;
  opcoes: { id: T; nome: string }[];
  selecionada: T;
  aoEscolher: (id: T) => void;
}) {
  const { t } = useTema();
  return (
    <View style={{ gap: 9 }}>
      <Rotulo>{rotulo}</Rotulo>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {opcoes.map((o) => {
          const ativo = selecionada === o.id;
          return (
            <Toque key={o.id} aoTocar={() => aoEscolher(o.id)} rotuloAcessivel={o.nome}>
              <View
                style={{
                  borderRadius: 999,
                  paddingVertical: 9,
                  paddingHorizontal: 15,
                  borderWidth: 1,
                  borderColor: ativo ? t.accent : t.lineInput,
                  backgroundColor: ativo ? t.accent : t.surface,
                }}
              >
                <Txt tamanho={12.5} peso={600} cor={ativo ? t.onAccent : t.inkMuted}>
                  {o.nome}
                </Txt>
              </View>
            </Toque>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Apagar em linha, com o peso visual que uma ação destrutiva merece: discreta
 * até ser tocada. Sem modal de confirmação — quem desfaz é o toast.
 */
export function BotaoApagar({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) {
  const { t } = useTema();
  return (
    <Toque aoTocar={aoTocar} estilo={{ alignSelf: 'center' }} rotuloAcessivel={rotulo}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          paddingVertical: 10,
          paddingHorizontal: 14,
        }}
      >
        <Icone path={icones.lixeira} tamanho={15} cor={t.down} espessura={1.8} />
        <Txt tamanho={12.5} peso={600} cor={t.down}>
          {rotulo}
        </Txt>
      </View>
    </Toque>
  );
}
