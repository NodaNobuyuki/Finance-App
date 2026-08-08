import React from 'react';
import { View } from 'react-native';
import {
  Barra,
  BotaoPrincipal,
  BotaoVoltar,
  CartaoNumero,
  Hero,
  Rotulo,
  Txt,
} from '../componentes/basicos';
import { categoria } from '../dominio/categorias';
import { rotuloIntervalo } from '../dominio/datas';
import { formatar } from '../dominio/dinheiro';
import { resumoDaSemana, semana } from '../estado/derivados';
import { useLoja } from '../estado/store';
import { resolverCor } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';

/**
 * Resumo da semana — a recompensa do ciclo.
 *
 * Aparece sozinho (pela Home) ou como passo 2 do fechamento; a diferença está
 * só no cabeçalho e no botão.
 */
export function Resumo() {
  const { estado, despachar } = useLoja();
  const { t, paleta } = useTema();

  const s = semana(estado);
  const r = resumoDaSemana(estado);
  const noFechamento = estado.fechando;

  return (
    <View>
      <Hero>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BotaoVoltar
            aoTocar={() =>
              noFechamento
                ? despachar({ tipo: 'FECHAR_PASSO', passo: 1 })
                : despachar({ tipo: 'IR_PARA', tela: 'home' })
            }
          />
          <Txt tamanho={16} peso={600} cor={t.onHero} espacamento={-0.16} estilo={{ flex: 1 }}>
            Resumo da semana
          </Txt>
          {noFechamento ? <Passos atual={2} /> : null}
        </View>

        <View style={{ gap: 6, marginTop: 18 }}>
          {noFechamento ? <Rotulo cor={t.onHeroSoft}>Passo 2 de 3</Rotulo> : null}
          <Txt tamanho={11.5} cor={t.onHeroSoft}>
            Gastos de {rotuloIntervalo(s.inicio, s.fim)}
          </Txt>
          <Txt tamanho={34} peso={600} numerico cor={t.onHero} espacamento={-1.02}>
            {formatar(r.totalCentavos)}
          </Txt>
          <Txt tamanho={12} cor={t.onHeroSoft}>
            {r.delta}
          </Txt>
        </View>
      </Hero>

      <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 26, gap: 24 }}>
        <View style={{ gap: 14 }}>
          <Txt tamanho={15} peso={600}>
            Para onde foi
          </Txt>
          {r.categorias.map((c) => (
            <View key={c.categoriaId} style={{ gap: 7 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <Txt tamanho={13} peso={500}>
                  {c.nome}
                </Txt>
                <Txt tamanho={13} peso={600} numerico>
                  {formatar(c.valorCentavos)}
                </Txt>
              </View>
              <Barra pct={c.pct} cor={resolverCor(categoria(c.categoriaId).cor, paleta)} />
              <Txt tamanho={11} cor={t.inkFaint}>
                {c.pct}% do que você gastou
              </Txt>
            </View>
          ))}
          {r.categorias.length === 0 ? (
            <Txt tamanho={12.5} cor={t.inkFaint} entrelinha={1.5}>
              Nenhum gasto registrado nesta semana — o que também é um resultado.
            </Txt>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <CartaoNumero
            rotulo="Maior gasto"
            valor={formatar(r.maiorValorCentavos)}
            nota={r.maiorNome}
          />
          <CartaoNumero
            rotulo="Lançamentos"
            valor={String(r.quantidade)}
            nota={`${formatar(r.mediaCentavos)} em média`}
          />
        </View>

        <Txt tamanho={12.5} cor={t.inkMuted} entrelinha={1.5}>
          Você recebe esse resumo sempre que fecha a semana com os registros em dia.
        </Txt>

        <BotaoPrincipal
          rotulo={noFechamento ? 'Continuar' : 'Voltar ao início'}
          aoTocar={() =>
            noFechamento
              ? despachar({ tipo: 'FECHAR_PASSO', passo: 3 })
              : despachar({ tipo: 'IR_PARA', tela: 'home' })
          }
        />
      </View>
    </View>
  );
}

/** Indicador de progresso do fechamento (3 passos). */
export function Passos({ atual }: { atual: 1 | 2 | 3 }) {
  const { t } = useTema();
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {[1, 2, 3].map((n) => (
        <View
          key={n}
          style={{
            width: 20,
            height: 4,
            borderRadius: 999,
            backgroundColor: n <= atual ? t.onHero : t.heroLine,
          }}
        />
      ))}
    </View>
  );
}
