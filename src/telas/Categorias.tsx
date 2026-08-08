import React from 'react';
import { View } from 'react-native';
import { Disco, Hero, Toque, Txt } from '../componentes/basicos';
import { Icone } from '../componentes/Icone';
import { categoria, categoriasDespesa, categoriasReceita, icones } from '../dominio/categorias';
import { formatar } from '../dominio/dinheiro';
import { transacoesDoMes } from '../estado/derivados';
import { useLoja } from '../estado/store';
import { resolverCor } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';

export function Categorias() {
  const { estado, despachar } = useLoja();
  const { t, paleta } = useTema();

  const doMes = transacoesDoMes(estado);
  const despesa = estado.abaCategorias === 'despesa';
  const chaves = despesa ? categoriasDespesa : categoriasReceita;

  const totalDe = (id: string) =>
    doMes.reduce((a, tx) => (tx.categoriaId === id ? a + Math.abs(tx.valorCentavos) : a), 0);

  const aba = (rotulo: string, ativa: boolean, aoTocar: () => void) => (
    <Toque aoTocar={aoTocar} estilo={{ flex: 1 }} rotuloAcessivel={rotulo}>
      <View
        style={{
          borderRadius: 8,
          paddingVertical: 7,
          paddingHorizontal: 13,
          alignItems: 'center',
          backgroundColor: ativa ? t.surface : 'transparent',
          elevation: ativa ? 1 : 0,
        }}
      >
        <Txt tamanho={12.5} peso={600} cor={ativa ? t.ink : t.inkMuted}>
          {rotulo}
        </Txt>
      </View>
    </Toque>
  );

  return (
    <View>
      <Hero estilo={{ paddingBottom: 22 }}>
        <Txt tamanho={16} peso={600} cor={t.onHero} espacamento={-0.16}>
          Categorias
        </Txt>
      </Hero>

      <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 26, gap: 16 }}>
        <View
          style={{
            flexDirection: 'row',
            gap: 2,
            borderRadius: 11,
            backgroundColor: t.segment,
            padding: 3,
          }}
        >
          {aba('Despesas', despesa, () => despachar({ tipo: 'ABA_CATEGORIAS', aba: 'despesa' }))}
          {aba('Receitas', !despesa, () => despachar({ tipo: 'ABA_CATEGORIAS', aba: 'receita' }))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {chaves.map((id) => {
            const cat = categoria(id);
            return (
              // Tocar numa categoria abre o extrato já filtrado — a tela não é
              // só um painel de totais.
              <Toque
                key={id}
                aoTocar={() => {
                  despachar({ tipo: 'FILTRO_CATEGORIA', categoria: id });
                  despachar({ tipo: 'FILTRO_CONTA', conta: 'todas' });
                  despachar({ tipo: 'IR_PARA', tela: 'extrato' });
                }}
                estilo={{ width: '31.5%' }}
                rotuloAcessivel={`Ver lançamentos de ${cat.nome}`}
              >
                <View
                  style={{
                    backgroundColor: t.surfaceMuted,
                    borderRadius: 16,
                    paddingVertical: 14,
                    paddingHorizontal: 10,
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Disco
                    path={cat.icone}
                    cor={t.onAccent}
                    fundo={resolverCor(cat.cor, paleta)}
                    tamanho={40}
                    icone={19}
                  />
                  <Txt tamanho={12} peso={600} alinhamento="center" entrelinha={1.25}>
                    {cat.nome}
                  </Txt>
                  <Txt tamanho={11} numerico cor={t.inkSoft}>
                    {formatar(totalDe(id))}
                  </Txt>
                </View>
              </Toque>
            );
          })}

          <View
            style={{
              width: '31.5%',
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: t.lineInput,
              borderRadius: 16,
              paddingVertical: 14,
              paddingHorizontal: 10,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: t.lineInput,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icone path={icones.mais} tamanho={18} cor={t.inkSoft} espessura={1.8} />
            </View>
            <Txt tamanho={12} peso={600} alinhamento="center" entrelinha={1.25} cor={t.inkSoft}>
              Nova categoria
            </Txt>
          </View>
        </View>
      </View>
    </View>
  );
}
