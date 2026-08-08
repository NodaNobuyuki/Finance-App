import React from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { BotaoPrincipal, BotaoVoltar, Hero, Toque, Txt } from '../componentes/basicos';
import { categoria } from '../dominio/categorias';
import { rotuloDia } from '../dominio/datas';
import { deTextoLivre } from '../dominio/dinheiro';
import { semana } from '../estado/derivados';
import { useLoja } from '../estado/store';
import { comAlfa, resolverCor } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';
import { mono } from '../tema/fontes';

/** Categorias oferecidas no lançamento em lote — as que cobrem o dia a dia. */
const CATEGORIAS_LOTE = ['mercado', 'restaurante', 'transporte', 'casa', 'lazer'];

/**
 * Colocar em dia.
 *
 * Reduz o custo de voltar depois de faltar: um valor e uma categoria por dia
 * aberto, com "não gastei" como resposta legítima.
 */
export function Lote() {
  const { estado, despachar } = useLoja();
  const { t, paleta } = useTema();

  const { pendentes } = semana(estado);

  const completo =
    pendentes.length > 0 &&
    pendentes.every((d) => {
      const linha = estado.lote[d];
      return linha && (linha.semGasto || deTextoLivre(linha.texto) > 0);
    });

  return (
    <View>
      <Hero estilo={{ paddingBottom: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BotaoVoltar aoTocar={() => despachar({ tipo: 'IR_PARA', tela: 'home' })} />
          <Txt tamanho={16} peso={600} cor={t.onHero} espacamento={-0.16}>
            Colocar em dia
          </Txt>
        </View>
        <Txt tamanho={12.5} cor={t.onHeroSoft} entrelinha={1.5} estilo={{ marginTop: 14 }}>
          Lance os dias em aberto de uma vez. Se não gastou nada, marque “não gastei”.
        </Txt>
      </Hero>

      <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 26, gap: 2 }}>
        {pendentes.map((dia, i) => {
          const linha = estado.lote[dia] ?? { texto: '', categoriaId: 'mercado', semGasto: false };
          return (
            <View
              key={dia}
              style={{
                gap: 11,
                paddingVertical: 18,
                borderBottomWidth: 1,
                borderBottomColor: i < pendentes.length - 1 ? t.lineSoft : 'transparent',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <Txt tamanho={13.5} peso={600}>
                  {rotuloDia(dia, estado.hoje)}
                </Txt>
                <Toque
                  aoTocar={() => despachar({ tipo: 'LOTE_SEM_GASTO', dia })}
                  rotuloAcessivel={`Não gastei em ${rotuloDia(dia, estado.hoje)}`}
                >
                  <View
                    style={{
                      borderRadius: 999,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: linha.semGasto ? t.accent : t.lineInput,
                      backgroundColor: linha.semGasto ? t.accent : t.surface,
                    }}
                  >
                    <Txt tamanho={11.5} peso={600} cor={linha.semGasto ? t.onAccent : t.inkMuted}>
                      Não gastei
                    </Txt>
                  </View>
                </Toque>
              </View>

              <View style={{ gap: 9, opacity: linha.semGasto ? 0.4 : 1 }}>
                <TextInput
                  value={linha.texto}
                  onChangeText={(texto) => despachar({ tipo: 'LOTE_VALOR', dia, texto })}
                  placeholder="R$ 0,00"
                  placeholderTextColor={t.inkFaint}
                  keyboardType="decimal-pad"
                  editable={!linha.semGasto}
                  style={[
                    mono(600),
                    {
                      backgroundColor: t.surface,
                      borderWidth: 1,
                      borderColor: t.lineInput,
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 13,
                      fontSize: 15,
                      color: t.ink,
                    },
                  ]}
                />

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {CATEGORIAS_LOTE.map((id) => {
                    const cat = categoria(id);
                    const cor = resolverCor(cat.cor, paleta);
                    const ativo = linha.categoriaId === id;
                    return (
                      <Toque
                        key={id}
                        aoTocar={() => despachar({ tipo: 'LOTE_CATEGORIA', dia, categoriaId: id })}
                        rotuloAcessivel={cat.nome}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            borderRadius: 999,
                            paddingVertical: 7,
                            paddingHorizontal: 12,
                            borderWidth: 1,
                            borderColor: ativo ? cor : t.line,
                            backgroundColor: ativo ? comAlfa(cor, 10) : t.surface,
                          }}
                        >
                          <View
                            style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: cor }}
                          />
                          <Txt tamanho={12} peso={600} cor={ativo ? t.ink : t.inkMuted}>
                            {cat.nome}
                          </Txt>
                        </View>
                      </Toque>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          );
        })}

        <View style={{ marginTop: 20 }}>
          <BotaoPrincipal
            rotulo={
              completo
                ? pendentes.length === 1
                  ? 'Salvar 1 dia'
                  : `Salvar ${pendentes.length} dias`
                : 'Preencha os dias em aberto'
            }
            fundo={completo ? t.accent : t.lineInput}
            desabilitado={!completo}
            aoTocar={() => despachar({ tipo: 'SALVAR_LOTE', pendentes })}
          />
        </View>

        <Txt
          tamanho={11.5}
          cor={t.inkFaint}
          alinhamento="center"
          entrelinha={1.5}
          estilo={{ marginTop: 12 }}
        >
          Atrasar acontece. O que conta é voltar.
        </Txt>
      </View>
    </View>
  );
}
