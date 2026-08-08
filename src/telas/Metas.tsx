import React from 'react';
import { View } from 'react-native';
import { Barra, Disco, Hero, Toque, Txt } from '../componentes/basicos';
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
        <View style={{ gap: 6 }}>
          <Txt tamanho={16} peso={600} cor={t.onHero} espacamento={-0.16}>
            Metas
          </Txt>
          <Txt tamanho={12.5} cor={t.onHeroSoft}>
            {formatar(totalGuardado(estado))} guardados
          </Txt>
        </View>
      </Hero>

      <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 26, gap: 26 }}>
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
                      {m.prazo}
                    </Txt>
                  </View>
                </View>
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
