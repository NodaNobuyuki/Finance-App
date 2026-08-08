import React from 'react';
import { View } from 'react-native';
import { icones } from '../dominio/categorias';
import { Tela } from '../dominio/tipos';
import { useLoja } from '../estado/store';
import { useTema } from '../tema/TemaContext';
import { Toque, Txt } from './basicos';
import { Icone } from './Icone';

const ABAS_ESQUERDA: { tela: Tela; nome: string; icone: string }[] = [
  { tela: 'home', nome: 'Início', icone: icones.inicio },
  { tela: 'extrato', nome: 'Extrato', icone: icones.extrato },
];

const ABAS_DIREITA: { tela: Tela; nome: string; icone: string }[] = [
  { tela: 'habitos', nome: 'Hábitos', icone: icones.habitos },
  { tela: 'metas', nome: 'Metas', icone: icones.metas },
];

export function NavInferior() {
  const { estado, despachar } = useLoja();
  const { t } = useTema();

  const aba = ({ tela, nome, icone }: { tela: Tela; nome: string; icone: string }) => {
    const ativa = estado.tela === tela;
    const cor = ativa ? t.accent : t.inkFaint;
    return (
      <Toque
        key={tela}
        aoTocar={() => despachar({ tipo: 'IR_PARA', tela })}
        estilo={{ flex: 1 }}
        rotuloAcessivel={nome}
      >
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Icone path={icone} tamanho={21} cor={cor} espessura={1.7} />
          <Txt tamanho={10.5} peso={600} cor={cor}>
            {nome}
          </Txt>
        </View>
      </Toque>
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 66,
        paddingHorizontal: 4,
        backgroundColor: t.surface,
        borderTopWidth: 1,
        borderTopColor: t.line,
      }}
    >
      {ABAS_ESQUERDA.map(aba)}

      <View style={{ width: 76, alignItems: 'center', justifyContent: 'center' }}>
        <Toque
          aoTocar={() => despachar({ tipo: 'ABRIR_NOVA' })}
          rotuloAcessivel="Nova transação"
          estilo={{ marginTop: -26 }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              backgroundColor: t.accent,
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 8,
              shadowColor: t.accent,
              shadowOpacity: 0.35,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <Icone path={icones.mais} tamanho={25} cor={t.onAccent} espessura={2} />
          </View>
        </Toque>
      </View>

      {ABAS_DIREITA.map(aba)}
    </View>
  );
}
