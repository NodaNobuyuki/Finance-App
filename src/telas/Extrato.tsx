import React from 'react';
import { ScrollView, View } from 'react-native';
import { Chip, Hero, Toque, Txt } from '../componentes/basicos';
import { ItemTransacao } from '../componentes/ItemTransacao';
import { categoria } from '../dominio/categorias';
import { rotuloDia, rotuloMesCurto } from '../dominio/datas';
import { comSinal, formatar } from '../dominio/dinheiro';
import { totalEntradas, totalSaidas } from '../dominio/saldo';
import { agruparPorDia, categoriasUsadas, transacoesFiltradas } from '../estado/derivados';
import { useLoja } from '../estado/store';
import { resolverCor } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';

export function Extrato() {
  const { estado, despachar } = useLoja();
  const { t, paleta } = useTema();

  const filtradas = transacoesFiltradas(estado);
  const grupos = agruparPorDia(filtradas);
  const entradas = totalEntradas(filtradas);
  const saidas = totalSaidas(filtradas);

  return (
    <View style={{ gap: 16 }}>
      <Hero estilo={{ paddingBottom: 22 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Txt tamanho={16} peso={600} cor={t.onHero} espacamento={-0.16}>
              Extrato
            </Txt>
            <Toque
              aoTocar={() => despachar({ tipo: 'IR_PARA', tela: 'categorias' })}
              rotuloAcessivel="Ver categorias"
            >
              <View
                style={{
                  borderWidth: 1,
                  borderColor: t.heroLine,
                  borderRadius: 999,
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                }}
              >
                <Txt tamanho={11} peso={600} cor={t.onHeroSoft}>
                  Categorias
                </Txt>
              </View>
            </Toque>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              borderWidth: 1,
              borderColor: t.heroLine,
              borderRadius: 999,
              paddingVertical: 4,
              paddingHorizontal: 8,
            }}
          >
            <Txt tamanho={13} cor={t.onHeroSoft}>
              ‹
            </Txt>
            <Txt tamanho={12} peso={600} cor={t.onHero}>
              {rotuloMesCurto(estado.hoje)}
            </Txt>
            <Txt tamanho={13} cor={t.onHeroSoft}>
              ›
            </Txt>
          </View>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 18,
          }}
        >
          <View style={{ gap: 4 }}>
            <Txt tamanho={11.5} cor={t.onHeroSoft}>
              Saldo do período
            </Txt>
            <Txt tamanho={26} peso={600} numerico cor={t.onHero} espacamento={-0.78}>
              {comSinal(entradas - saidas)}
            </Txt>
          </View>
          <View style={{ gap: 5, alignItems: 'flex-end' }}>
            <Txt tamanho={11.5} cor={t.onHeroSoft}>
              entradas{' '}
              <Txt tamanho={11.5} peso={600} numerico cor={t.onHero}>
                {formatar(entradas)}
              </Txt>
            </Txt>
            <Txt tamanho={11.5} cor={t.onHeroSoft}>
              saídas{' '}
              <Txt tamanho={11.5} peso={600} numerico cor={t.onHero}>
                {formatar(saidas)}
              </Txt>
            </Txt>
          </View>
        </View>
      </Hero>

      <View style={{ gap: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingHorizontal: 18 }}
        >
          {[{ id: 'todas', nome: 'Todas as contas' }, ...estado.contas].map((c) => (
            <Chip
              key={c.id}
              rotulo={c.nome}
              ativo={estado.filtroConta === c.id}
              aoTocar={() => despachar({ tipo: 'FILTRO_CONTA', conta: c.id })}
            />
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 7, paddingHorizontal: 18 }}
        >
          <Chip
            rotulo="Todas"
            ponto={t.inkFaint}
            ativo={estado.filtroCategoria === 'todas'}
            aoTocar={() => despachar({ tipo: 'FILTRO_CATEGORIA', categoria: 'todas' })}
          />
          {categoriasUsadas(estado).map((id) => {
            const cat = categoria(id);
            return (
              <Chip
                key={id}
                rotulo={cat.nome}
                ponto={resolverCor(cat.cor, paleta)}
                ativo={estado.filtroCategoria === id}
                aoTocar={() => despachar({ tipo: 'FILTRO_CATEGORIA', categoria: id })}
              />
            );
          })}
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: 18, paddingBottom: 22, gap: 16 }}>
        {grupos.map((g) => (
          <View key={g.dia} style={{ gap: 4 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 2,
              }}
            >
              <Txt tamanho={11} peso={600} maiusculas espacamento={0.5} cor={t.inkFaint}>
                {rotuloDia(g.dia, estado.hoje)}
              </Txt>
              <Txt tamanho={11.5} peso={600} numerico cor={t.inkFaint}>
                {comSinal(g.totalCentavos)}
              </Txt>
            </View>
            {g.itens.map((tx, i) => (
              <ItemTransacao key={tx.id} tx={tx} separador={i < g.itens.length - 1} />
            ))}
          </View>
        ))}

        {grupos.length === 0 ? (
          <View style={{ paddingVertical: 34, alignItems: 'center' }}>
            <Txt tamanho={13} cor={t.inkFaint}>
              Nenhuma transação com esses filtros.
            </Txt>
          </View>
        ) : null}
      </View>
    </View>
  );
}
