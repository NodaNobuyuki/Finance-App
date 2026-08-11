import React from 'react';
import { ScrollView, View } from 'react-native';
import { Toque, Txt } from '../../componentes/basicos';
import { Icone } from '../../componentes/Icone';
import { categoria, categoriasPorTipo } from '../../dominio/categorias';
import { comSinal } from '../../dominio/dinheiro';
import { useLoja } from '../../estado/store';
import { comAlfa, resolverCor } from '../../tema/paletas';
import { useTema } from '../../tema/TemaContext';
import { Folha } from './Folha';

/**
 * Trocar a categoria de um lançamento já feito.
 *
 * Faltava desde que `categoria()` passou a devolver uma categoria órfã em vez
 * de lançar: a linha aparecia como "Sem categoria" e não havia caminho de
 * volta. Agora que apagar categoria é possível, esse caminho deixou de ser
 * hipotético.
 */
export function Recategorizar({ transacaoId }: { transacaoId: string }) {
  const { estado, despachar } = useLoja();
  const { t, paleta } = useTema();

  const tx = estado.transacoes.find((x) => x.id === transacaoId);
  if (!tx) return null;

  const atual = categoria(estado.categorias, tx.categoriaId);
  // O tipo vem do SINAL do lançamento, não da categoria atual: uma linha órfã
  // não tem tipo confiável, e o sinal é o dado que não mente.
  const lista = categoriasPorTipo(estado.categorias, tx.valorCentavos < 0 ? 'despesa' : 'receita');

  return (
    <Folha titulo="Mudar categoria" aoFechar={() => despachar({ tipo: 'FECHAR_FOLHA' })}>
      <View style={{ paddingHorizontal: 22, paddingBottom: 6, alignItems: 'center', gap: 4 }}>
        <Txt tamanho={15} peso={600} alinhamento="center">
          {tx.descricao}
        </Txt>
        <Txt tamanho={12.5} numerico cor={tx.valorCentavos < 0 ? t.down : t.up}>
          {comSinal(tx.valorCentavos)}
        </Txt>
        <Txt tamanho={11.5} cor={t.inkFaint}>
          hoje em {atual.nome}
        </Txt>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 22, gap: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {lista.map((cat) => {
            const cor = resolverCor(cat.cor, paleta);
            const ativo = cat.id === tx.categoriaId;
            return (
              <Toque
                key={cat.id}
                aoTocar={() =>
                  despachar({ tipo: 'RECATEGORIZAR', transacaoId: tx.id, categoriaId: cat.id })
                }
                estilo={{ width: '23%' }}
                rotuloAcessivel={`Mover para ${cat.nome}`}
              >
                <View
                  style={{
                    borderRadius: 14,
                    paddingVertical: 9,
                    paddingHorizontal: 4,
                    alignItems: 'center',
                    gap: 6,
                    borderWidth: 1,
                    borderColor: ativo ? cor : t.line,
                    backgroundColor: ativo ? comAlfa(cor, 10) : t.surface,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: ativo ? cor : comAlfa(cor, 14),
                    }}
                  >
                    <Icone
                      path={cat.icone}
                      tamanho={16}
                      cor={ativo ? t.onAccent : cor}
                      espessura={1.7}
                    />
                  </View>
                  <Txt tamanho={10.5} peso={600} alinhamento="center" entrelinha={1.2} linhas={2}>
                    {cat.nome}
                  </Txt>
                </View>
              </Toque>
            );
          })}
        </View>
      </ScrollView>
    </Folha>
  );
}
