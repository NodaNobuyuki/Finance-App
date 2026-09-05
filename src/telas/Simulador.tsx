import React from 'react';
import { View } from 'react-native';
import { BotaoPrincipal, BotaoVoltar, Hero, Rotulo, Toque, Txt } from '../componentes/basicos';
import { Teclado } from '../componentes/Teclado';
import { deDigitos, formatar, percentual } from '../dominio/dinheiro';
import { metaEscolhida } from '../dominio/metas';
import { taxas } from '../dominio/taxas';
import { metas, projecao } from '../estado/derivados';
import { useLoja } from '../estado/store';
import { useTema } from '../tema/TemaContext';
import { Pilulas } from './folhas/PilulasDeConta';

export function Simulador() {
  const { estado, despachar } = useLoja();
  const { t } = useTema();

  const valor = deDigitos(estado.simDigitos);
  const em5anos = projecao(valor, estado.simTaxaId, 5);
  const rendimento = em5anos - valor;

  // O destino era a constante `'reserva'` — id da semente da demo. Quem
  // instalou o app tem metas com UUID, então o botão que fecha o loop não
  // achava meta nenhuma e morria calado. Agora a meta é escolhida aqui.
  const lista = metas(estado);
  const meta = metaEscolhida(lista, estado.simMetaId);
  const pctDaMeta = meta ? Math.min(100, percentual(valor, meta.alvoCentavos)) : 0;
  const contaDaMeta = estado.contas.find((c) => c.id === meta?.contaId);
  const origem = estado.contas.find((c) => c.id === estado.rascunho.contaId);

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
            {taxas.map((taxa) => {
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
          {valor === 0
            ? 'Digite um valor para ver o custo de oportunidade.'
            : meta
              ? `Esse valor cobre ${pctDaMeta}% da meta ${meta.nome}.`
              : 'Crie uma meta para transformar esse valor em dinheiro guardado.'}
        </Txt>

        {meta ? (
          <Pilulas
            rotulo="GUARDAR EM"
            itens={lista}
            selecionado={meta.id}
            aoEscolher={(metaId) => despachar({ tipo: 'SIM_META', metaId })}
            nota={
              contaDaMeta === undefined
                ? 'Esta meta ainda não tem onde guardar.'
                : contaDaMeta.id === origem?.id
                  ? `Fica em ${contaDaMeta.nome} — o dinheiro já está lá, o saldo não muda.`
                  : `Sai de ${origem?.nome ?? 'sua conta'} e vai para ${contaDaMeta.nome}.`
            }
          />
        ) : null}

        <Teclado
          altura={44}
          aoDigitar={(d) => despachar({ tipo: 'SIM_DIGITO', valor: d })}
          aoApagar={() => despachar({ tipo: 'SIM_APAGAR' })}
        />

        {/* Sem meta o botão não mente: leva a criar uma, que é o que falta. */}
        {meta === undefined ? (
          <BotaoPrincipal
            rotulo="Criar uma meta"
            fundo={t.accent}
            aoTocar={() => despachar({ tipo: 'ABRIR_META' })}
          />
        ) : (
          <BotaoPrincipal
            rotulo={valor === 0 ? 'Informe um valor' : `Guardar em ${meta.nome}`}
            fundo={valor === 0 ? t.lineInput : t.up}
            desabilitado={valor === 0}
            aoTocar={() => despachar({ tipo: 'SIM_GUARDAR' })}
          />
        )}
      </View>
    </View>
  );
}
