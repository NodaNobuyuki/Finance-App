import React from 'react';
import { View } from 'react-native';
import { Barra, Disco, Hero, Toque, Txt } from '../componentes/basicos';
import { Icone } from '../componentes/Icone';
import { Vazio } from '../componentes/Vazio';
import { icones } from '../dominio/categorias';
import { formatar } from '../dominio/dinheiro';
import { metas, totalGuardado } from '../estado/derivados';
import { useLoja } from '../estado/store';
import { resolverCor } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';

export function Metas() {
  const { estado, despachar } = useLoja();
  const { t, paleta } = useTema();
  const lista = metas(estado);

  return (
    <View>
      <Hero estilo={{ paddingBottom: 22 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ gap: 6 }}>
            <Txt tamanho={16} peso={600} cor={t.onHero} espacamento={-0.16}>
              Metas
            </Txt>
            <Txt tamanho={12.5} cor={t.onHeroSoft}>
              {formatar(totalGuardado(estado))} guardados
            </Txt>
          </View>

          <Toque
            aoTocar={() => despachar({ tipo: 'ABRIR_META' })}
            rotuloAcessivel="Nova meta"
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: t.heroLine,
                paddingVertical: 7,
                paddingHorizontal: 13,
              }}
            >
              <Icone path={icones.mais} tamanho={14} cor={t.onHero} espessura={2} />
              <Txt tamanho={12.5} peso={600} cor={t.onHero}>
                Nova meta
              </Txt>
            </View>
          </Toque>
        </View>
      </Hero>

      <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 26, gap: 26 }}>
        {lista.length === 0 ? (
          <Vazio
            icone={icones.metas}
            titulo="Nenhuma meta ainda"
            texto="Meta é o que transforma gasto evitado em algo concreto. Sem uma, o dinheiro que sobra não vira nada."
            acao={{
              rotulo: 'Criar primeira meta',
              aoTocar: () => despachar({ tipo: 'ABRIR_META' }),
            }}
          />
        ) : null}

        {lista.map((m) => {
          const cor = resolverCor(m.cor, paleta);
          return (
            <View key={m.id} style={{ gap: 13 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}>
                  <Disco path={m.icone} cor={t.onAccent} fundo={cor} icone={19} />
                  <View style={{ gap: 2, flex: 1 }}>
                    <Txt tamanho={14.5} peso={600}>
                      {m.nome}
                    </Txt>
                    <Txt tamanho={11.5} cor={t.inkSoft}>
                      {m.prazoLabel}
                    </Txt>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      backgroundColor: t.accentSoft,
                      borderRadius: 999,
                      paddingVertical: 4,
                      paddingHorizontal: 9,
                    }}
                  >
                    <Txt tamanho={12.5} peso={600} numerico cor={t.accent}>
                      {m.pct}%
                    </Txt>
                  </View>

                  <Toque
                    aoTocar={() => despachar({ tipo: 'ABRIR_META', metaId: m.id })}
                    rotuloAcessivel={`Editar ${m.nome}`}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: t.surfaceMuted,
                      }}
                    >
                      <Icone path={icones.lapis} tamanho={14} cor={t.inkMuted} espessura={1.8} />
                    </View>
                  </Toque>
                </View>
              </View>

              <View style={{ gap: 7 }}>
                <Barra pct={m.pct} cor={cor} />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                  }}
                >
                  <Txt tamanho={15} peso={600} numerico>
                    {formatar(m.guardadoCentavos)}
                  </Txt>
                  <Txt tamanho={12.5} numerico cor={t.inkSoft}>
                    de {formatar(m.alvoCentavos)}
                  </Txt>
                </View>
              </View>

              <Toque
                aoTocar={() => despachar({ tipo: 'ABRIR_APORTE', metaId: m.id })}
                estilo={{ alignSelf: 'flex-start' }}
                rotuloAcessivel={`Adicionar valor a ${m.nome}`}
              >
                <View
                  style={{
                    borderRadius: 999,
                    paddingVertical: 9,
                    paddingHorizontal: 16,
                    backgroundColor: t.accentSoft,
                  }}
                >
                  <Txt tamanho={12.5} peso={600} cor={t.accent}>
                    Adicionar valor
                  </Txt>
                </View>
              </Toque>
            </View>
          );
        })}
      </View>
    </View>
  );
}
