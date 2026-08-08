import React from 'react';
import { View } from 'react-native';
import { categoria } from '../dominio/categorias';
import { comSinal } from '../dominio/dinheiro';
import { Transacao } from '../dominio/tipos';
import { useLoja } from '../estado/store';
import { comAlfa, resolverCor } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';
import { Disco, Txt } from './basicos';

export function ItemTransacao({ tx, separador }: { tx: Transacao; separador: boolean }) {
  const { estado } = useLoja();
  const { t, paleta } = useTema();
  const cat = categoria(tx.categoriaId);
  const cor = resolverCor(cat.cor, paleta);
  const nomeDaConta = estado.contas.find((c) => c.id === tx.contaId)?.nome ?? '';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingVertical: 13,
        borderBottomWidth: 1,
        borderBottomColor: separador ? t.lineSoft : 'transparent',
      }}
    >
      <Disco path={cat.icone} cor={cor} fundo={comAlfa(cor, 14)} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt tamanho={13.5} peso={600} linhas={1}>
          {tx.descricao}
        </Txt>
        <Txt tamanho={11.5} cor={t.inkSoft}>
          {cat.nome} · {nomeDaConta}
        </Txt>
      </View>
      <Txt tamanho={14} peso={600} numerico cor={tx.valorCentavos < 0 ? t.ink : t.up}>
        {comSinal(tx.valorCentavos)}
      </Txt>
    </View>
  );
}
