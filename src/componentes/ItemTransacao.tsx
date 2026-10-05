import React from 'react';
import { View } from 'react-native';
import { categoria } from '../dominio/categorias';
import { comSinal } from '../dominio/dinheiro';
import { Transacao } from '../dominio/tipos';
import { useRecorte, useDespachar } from '../estado/store';
import { comAlfa, resolverCor } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';
import { Disco, Toque, Txt } from './basicos';

/** O que esta tela lê do estado — e só isto a acorda. */
const CHAVES = ['contas', 'categorias'] as const;

export function ItemTransacao({
  tx,
  separador,
  editavel = false,
}: {
  tx: Transacao;
  separador: boolean;
  /**
   * Tocar abre a edição do lançamento — ou o detalhe do par, se for
   * transferência. Só no Extrato: na Home a lista é resumo, e transformar cada
   * linha em botão ali competiria com o registro rápido.
   */
  editavel?: boolean;
}) {
  const estado = useRecorte(CHAVES);
  const despachar = useDespachar();
  const { t, paleta } = useTema();
  const cat = categoria(estado.categorias, tx.categoriaId);
  const cor = resolverCor(cat.cor, paleta);
  const nomeDaConta = estado.contas.find((c) => c.id === tx.contaId)?.nome ?? '';

  const conteudo = (
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

  if (!editavel) return conteudo;

  return (
    <Toque
      aoTocar={() => despachar({ tipo: 'ABRIR_LANCAMENTO', transacaoId: tx.id })}
      rotuloAcessivel={
        tx.transferenciaId === undefined ? `Editar ${tx.descricao}` : `Ver ${tx.descricao}`
      }
    >
      {conteudo}
    </Toque>
  );
}
