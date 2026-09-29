import React, { useMemo } from 'react';
import { ScrollView, SectionList, View } from 'react-native';
import { Chip, Hero, Toque, Txt } from '../componentes/basicos';
import { ItemTransacao } from '../componentes/ItemTransacao';
import { Vazio } from '../componentes/Vazio';
import { categoria, icones } from '../dominio/categorias';
import { rotuloDia } from '../dominio/datas';
import { comSinal, formatar } from '../dominio/dinheiro';
import { totalEntradas, totalSaidas } from '../dominio/saldo';
import {
  agruparPorDia,
  categoriasUsadas,
  GrupoDoDia,
  navegacaoDeMes,
  transacoesDoMesVisivel,
  transacoesFiltradas,
} from '../estado/derivados';
import { useRecorte, useDespachar } from '../estado/store';
import { Transacao } from '../dominio/tipos';
import { resolverCor } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';

/** O que esta tela lê do estado — e só isto a acorda. */
const CHAVES = ['transacoes', 'mesVisivel', 'filtroConta', 'filtroCategoria', 'hoje', 'contas', 'categorias'] as const;

/** Seta do seletor de mês. Apagada quando não há para onde ir. */
function SetaDeMes({ passo, ativa, rotulo }: { passo: -1 | 1; ativa: boolean; rotulo: string }) {
  const despachar = useDespachar();
  const { t } = useTema();
  return (
    <Toque
      aoTocar={() => (ativa ? despachar({ tipo: 'MES_VISIVEL', passo }) : undefined)}
      rotuloAcessivel={rotulo}
    >
      <View style={{ paddingHorizontal: 4, paddingVertical: 2, opacity: ativa ? 1 : 0.3 }}>
        <Txt tamanho={13} cor={t.onHeroSoft}>
          {passo === -1 ? '‹' : '›'}
        </Txt>
      </View>
    </Toque>
  );
}

type SecaoDoDia = GrupoDoDia & { data: Transacao[] };

/** 4px entre linhas do mesmo dia — o `gap` que o grupo tinha antes da lista. */
function EntreLinhas() {
  return <View style={{ height: 4 }} />;
}

/**
 * O Extrato rola sozinho, e é o único.
 *
 * As outras telas vivem no `ScrollView` da `Casca`; esta não, porque um
 * `SectionList` dentro de outra rolagem vertical desenha todas as linhas de
 * uma vez e a virtualização vira enfeite. Com o histórico crescendo mês a mês,
 * é aqui que a lista precisa só do que cabe na tela — ver `TELAS_COM_ROLAGEM_PROPRIA`
 * em `App.tsx`. Cabeçalho, chips e vazio entram como cabeçalho da lista.
 */
export function Extrato() {
  const estado = useRecorte(CHAVES);
  const despachar = useDespachar();
  const { t, paleta } = useTema();

  // Memoizado por campo: com uma folha aberta por cima, cada tecla do teclado
  // numérico troca o `Estado`, e nada disto mudou.
  const { transacoes, mesVisivel, filtroConta, filtroCategoria, hoje } = estado;
  const mes = useMemo(
    () => navegacaoDeMes({ transacoes, mesVisivel, hoje }),
    [transacoes, mesVisivel, hoje],
  );
  const doMes = useMemo(
    () => transacoesDoMesVisivel({ transacoes, mesVisivel }),
    [transacoes, mesVisivel],
  );
  const filtradas = useMemo(
    () => transacoesFiltradas({ transacoes, mesVisivel, filtroConta, filtroCategoria }),
    [transacoes, mesVisivel, filtroConta, filtroCategoria],
  );
  const secoes = useMemo<SecaoDoDia[]>(
    () => agruparPorDia(filtradas).map((g) => ({ ...g, data: g.itens })),
    [filtradas],
  );
  const usadas = useMemo(() => categoriasUsadas({ transacoes }), [transacoes]);
  const entradas = totalEntradas(filtradas);
  const saidas = totalSaidas(filtradas);

  const cabecalho = (
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
            <SetaDeMes passo={-1} ativa={mes.podeVoltar} rotulo="Mês anterior" />
            <Txt tamanho={12} peso={600} cor={t.onHero}>
              {mes.rotulo}
            </Txt>
            <SetaDeMes passo={1} ativa={mes.podeAvancar} rotulo="Mês seguinte" />
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
          {usadas.map((id) => {
            const cat = categoria(estado.categorias, id);
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
    </View>
  );

  // Três coisas diferentes, e a saída de cada uma é outra: ainda não há nada,
  // o mês está vazio, ou o filtro não casou.
  const vazio = (
    <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
      {estado.transacoes.length === 0 ? (
        <Vazio
          icone={icones.extrato}
          titulo="Seu extrato começa aqui"
          texto="Cada lançamento vira histórico, e o histórico é o que mostra para onde seu dinheiro vai."
          acao={{
            rotulo: 'Registrar o primeiro',
            aoTocar: () => despachar({ tipo: 'ABRIR_NOVA' }),
          }}
        />
      ) : doMes.length === 0 ? (
        <Vazio
          compacto
          icone={icones.calendario}
          titulo={`Nada em ${mes.rotulo}`}
          texto="Nenhum lançamento neste mês. Use as setas para ver outro."
          acao={
            mes.podeVoltar
              ? {
                  rotulo: 'Ver o mês anterior',
                  aoTocar: () => despachar({ tipo: 'MES_VISIVEL', passo: -1 }),
                }
              : undefined
          }
        />
      ) : (
        <Vazio
          compacto
          icone={icones.grafico}
          titulo="Nenhuma transação com esses filtros"
          texto="Tente outra conta ou outra categoria."
          acao={{
            rotulo: 'Limpar filtros',
            aoTocar: () => {
              despachar({ tipo: 'FILTRO_CONTA', conta: 'todas' });
              despachar({ tipo: 'FILTRO_CATEGORIA', categoria: 'todas' });
            },
          }}
        />
      )}
    </View>
  );

  return (
    <SectionList
      sections={secoes}
      keyExtractor={(tx) => tx.id}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 22 }}
      showsVerticalScrollIndicator={false}
      // Fixar o dia no topo precisaria de fundo próprio e mudaria o desenho;
      // o padrão também difere entre iOS (fixo) e Android (solto).
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={cabecalho}
      ListEmptyComponent={vazio}
      ItemSeparatorComponent={EntreLinhas}
      renderSectionHeader={({ section }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingTop: 16,
            marginBottom: 6,
          }}
        >
          <Txt tamanho={11} peso={600} maiusculas espacamento={0.5} cor={t.inkFaint}>
            {rotuloDia(section.dia, hoje)}
          </Txt>
          <Txt tamanho={11.5} peso={600} numerico cor={t.inkFaint}>
            {comSinal(section.totalCentavos)}
          </Txt>
        </View>
      )}
      renderItem={({ item, index, section }) => (
        <View style={{ paddingHorizontal: 18 }}>
          <ItemTransacao tx={item} separador={index < section.data.length - 1} recategorizavel />
        </View>
      )}
    />
  );
}
