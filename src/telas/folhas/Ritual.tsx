import React from 'react';
import { ScrollView, View } from 'react-native';
import { BotaoPrincipal, Rotulo, Toque, Txt } from '../../componentes/basicos';
import { diasRitual } from '../../dominio/datas';
import { resumoDoRitual } from '../../estado/derivados';
import { useLoja } from '../../estado/store';
import { useTema } from '../../tema/TemaContext';
import { Folha } from './Folha';

const METAS = [
  { n: 3, sub: 'dias alternados' },
  { n: 4, sub: 'equilibrado' },
  { n: 5, sub: 'quase diário' },
  { n: 7, sub: 'todo dia' },
];

/**
 * O ritual: dia de fechamento + meta de registros por semana.
 *
 * É a única configuração que o produto pede de cara, porque um hábito precisa
 * de um momento fixo — sem isso o resto do loop não tem âncora.
 */
export function Ritual() {
  const { estado, despachar } = useLoja();
  const { t } = useTema();
  const primeira = estado.ritualPrimeira;

  return (
    <Folha
      cabecalho={
        <View
          style={{
            backgroundColor: t.hero,
            paddingHorizontal: 22,
            paddingVertical: 26,
            gap: 9,
          }}
        >
          <Rotulo cor={t.onHeroSoft}>Poupa</Rotulo>
          <Txt tamanho={27} peso={600} cor={t.onHero} espacamento={-0.81} entrelinha={1.1}>
            {primeira ? 'Escolha seu ritual' : 'Seu ritual'}
          </Txt>
          <Txt tamanho={13} cor={t.onHeroSoft} entrelinha={1.5}>
            Um hábito precisa de um momento fixo. Escolha o dia em que você senta com suas contas e
            quantas vezes por semana quer registrar.
          </Txt>
        </View>
      }
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 22,
          paddingTop: 24,
          paddingBottom: 26,
          gap: 26,
        }}
      >
        <View style={{ gap: 12 }}>
          <View style={{ gap: 3 }}>
            <Txt tamanho={14.5} peso={600}>
              Que dia você fecha a semana?
            </Txt>
            <Txt tamanho={12} cor={t.inkSoft} entrelinha={1.45}>
              Nesse dia o app te convida a revisar e fechar.
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {diasRitual.map((d) => {
              const ativo = estado.ritualDiaFechamento === d.id;
              return (
                <Toque
                  key={d.id}
                  aoTocar={() => despachar({ tipo: 'RITUAL_DIA', dia: d.id })}
                  estilo={{ flex: 1 }}
                  rotuloAcessivel={d.nome}
                >
                  <View
                    style={{
                      height: 44,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: ativo ? t.accent : t.lineInput,
                      backgroundColor: ativo ? t.accent : t.surface,
                    }}
                  >
                    <Txt
                      tamanho={11.5}
                      peso={ativo ? 700 : 500}
                      cor={ativo ? t.onAccent : t.inkMuted}
                    >
                      {d.letra}
                    </Txt>
                  </View>
                </Toque>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <View style={{ gap: 3 }}>
            <Txt tamanho={14.5} peso={600}>
              Quantos registros por semana?
            </Txt>
            <Txt tamanho={12} cor={t.inkSoft} entrelinha={1.45}>
              Escolha o que você consegue manter numa semana ruim, não numa boa.
            </Txt>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {METAS.map((m) => {
              const ativo = estado.metaSemanal === m.n;
              return (
                <Toque
                  key={m.n}
                  aoTocar={() => despachar({ tipo: 'RITUAL_META', meta: m.n })}
                  estilo={{ flex: 1 }}
                  rotuloAcessivel={`${m.n} registros por semana, ${m.sub}`}
                >
                  <View
                    style={{
                      borderRadius: 14,
                      paddingVertical: 13,
                      paddingHorizontal: 6,
                      alignItems: 'center',
                      gap: 3,
                      borderWidth: 1,
                      borderColor: ativo ? t.accent : t.lineInput,
                      backgroundColor: ativo ? t.accentSoft : t.surface,
                    }}
                  >
                    <Txt tamanho={19} peso={600} numerico cor={ativo ? t.accent : t.ink}>
                      {m.n}
                    </Txt>
                    <Txt
                      tamanho={9.5}
                      alinhamento="center"
                      entrelinha={1.2}
                      cor={ativo ? t.accent : t.inkFaint}
                    >
                      {m.sub}
                    </Txt>
                  </View>
                </Toque>
              );
            })}
          </View>
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: t.line, paddingTop: 18 }}>
          <Txt tamanho={12.5} cor={t.inkMuted} entrelinha={1.55}>
            {resumoDoRitual(estado)}
          </Txt>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 22, paddingBottom: 24 }}>
        <BotaoPrincipal
          rotulo={primeira ? 'Começar' : 'Salvar ritual'}
          aoTocar={() => despachar({ tipo: 'RITUAL_SALVAR' })}
        />
      </View>
    </Folha>
  );
}
