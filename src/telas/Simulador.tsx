import React from 'react';
import { View } from 'react-native';
import { BotaoPrincipal, BotaoVoltar, Hero, Rotulo, Toque, Txt } from '../componentes/basicos';
import { Teclado } from '../componentes/Teclado';
import { deDigitos, formatar, percentual } from '../dominio/dinheiro';
import * as seed from '../dominio/seed';
import { metas, projecao } from '../estado/derivados';
import { useLoja } from '../estado/store';
import { useTema } from '../tema/TemaContext';

/** Meta que recebe o valor quando o usuário decide guardar em vez de gastar. */
const META_PADRAO = 'reserva';

export function Simulador() {
  const { estado, despachar } = useLoja();
  const { t } = useTema();

  const valor = deDigitos(estado.simDigitos);
  const em5anos = projecao(valor, estado.simTaxaId, 5);
  const rendimento = em5anos - valor;
  const reserva = metas(estado).find((m) => m.id === META_PADRAO);
  const pctReserva = reserva ? Math.min(100, percentual(valor, reserva.alvoCentavos)) : 0;

  return (
    <View>
      <Hero>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BotaoVoltar aoTocar={() => despachar({ tipo: 'IR_PARA', tela: 'home' })} />
          <Txt tamanho={16} peso={600} cor={t.onHero} espacamento={-0.16}>
            Vale a pena?
          </Txt>
        </View>
        <View style={{ gap: 6, marginTop: 20 }}>
          <Txt tamanho={11.5} cor={t.onHeroSoft}>
            Valor que você deixa de gastar
          </Txt>
          <Txt tamanho={38} peso={600} numerico cor={t.onHero} espacamento={-1.14}>
            {formatar(valor)}
          </Txt>
        </View>
      </Hero>

      <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 26, gap: 24 }}>
        <View style={{ gap: 9 }}>
          <Rotulo>Onde investir</Rotulo>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            {seed.taxas.map((taxa) => {
              const ativa = taxa.id === estado.simTaxaId;
              return (
                <Toque
                  key={taxa.id}
                  aoTocar={() => despachar({ tipo: 'SIM_TAXA', taxaId: taxa.id })}
                  estilo={{ flex: 1 }}
                  rotuloAcessivel={`${taxa.nome}, ${taxa.rotulo}`}
                >
                  <View
                    style={{
                      borderRadius: 12,
                      paddingVertical: 9,
                      paddingHorizontal: 6,
                      alignItems: 'center',
                      gap: 2,
                      borderWidth: 1,
                      borderColor: ativa ? t.accent : t.lineInput,
                      backgroundColor: ativa ? t.accent : t.surface,
                    }}
                  >
                    <Txt tamanho={12} peso={600} cor={ativa ? t.onAccent : t.inkMuted}>
                      {taxa.nome}
                    </Txt>
                    <Txt
                      tamanho={10.5}
                      numerico
                      cor={ativa ? t.onAccent : t.inkMuted}
                      estilo={{ opacity: 0.75 }}
                    >
                      {taxa.rotulo}
                    </Txt>
                  </View>
                </Toque>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 14 }}>
          <View style={{ gap: 5 }}>
            <Txt tamanho={12.5} cor={t.inkMuted}>
              Em 5 anos, esse dinheiro investido seria
            </Txt>
            <Txt tamanho={34} peso={600} numerico cor={t.up} espacamento={-1.02}>
              {formatar(em5anos)}
            </Txt>
            <Txt tamanho={12} cor={t.inkSoft}>
              + {formatar(rendimento)} de rendimento sobre {formatar(valor)}
            </Txt>
          </View>

          {/* Principal × rendimento */}
          <View
            style={{
              flexDirection: 'row',
              height: 10,
              borderRadius: 999,
              overflow: 'hidden',
              backgroundColor: t.segment,
            }}
          >
            <View
              style={{
                backgroundColor: t.accent,
                width: `${em5anos > 0 ? percentual(valor, em5anos) : 100}%`,
              }}
            />
            <View style={{ backgroundColor: t.up, flex: 1 }} />
          </View>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            {[
              { cor: t.accent, rotulo: 'valor de hoje' },
              { cor: t.up, rotulo: 'rendimento' },
            ].map((l) => (
              <View key={l.rotulo} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: l.cor }} />
                <Txt tamanho={11} cor={t.inkSoft}>
                  {l.rotulo}
                </Txt>
              </View>
            ))}
          </View>
        </View>

        <View style={{ gap: 2 }}>
          {[1, 3, 10].map((anos, i) => (
            <View
              key={anos}
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 10,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: i < 2 ? t.lineSoft : 'transparent',
              }}
            >
              <Txt tamanho={13} cor={t.inkMuted}>
                Em {anos} {anos === 1 ? 'ano' : 'anos'}
              </Txt>
              <Txt tamanho={14} peso={600} numerico>
                {formatar(projecao(valor, estado.simTaxaId, anos))}
              </Txt>
            </View>
          ))}
        </View>

        <Txt tamanho={12.5} cor={t.inkMuted} entrelinha={1.5}>
          {valor > 0 && reserva
            ? `Esse valor cobre ${pctReserva}% da sua ${reserva.nome} hoje.`
            : 'Digite um valor para ver o custo de oportunidade.'}
        </Txt>

        <Teclado
          altura={44}
          aoDigitar={(d) => despachar({ tipo: 'SIM_DIGITO', valor: d })}
          aoApagar={() => despachar({ tipo: 'SIM_APAGAR' })}
        />

        <BotaoPrincipal
          rotulo={valor === 0 ? 'Informe um valor' : 'Guardar em vez de gastar'}
          fundo={valor === 0 ? t.lineInput : t.up}
          desabilitado={valor === 0}
          aoTocar={() => despachar({ tipo: 'SIM_GUARDAR', metaId: META_PADRAO })}
        />
      </View>
    </View>
  );
}
