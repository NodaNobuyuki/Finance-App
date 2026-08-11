import React from 'react';
import { View } from 'react-native';
import { Barra, BotaoVoltar, CartaoNumero, Disco, Hero, Toque, Txt } from '../componentes/basicos';
import { categoria } from '../dominio/categorias';
import { nomeDoMes } from '../dominio/datas';
import { semTransferencias } from '../dominio/saldo';
import {
  desafios,
  historicoDeSemanas,
  resumoDoRitual,
  semana,
  semanasEmDia,
  transacoesDoMes,
} from '../estado/derivados';
import { useLoja } from '../estado/store';
import { comAlfa, resolverCor } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';

const LEMBRETES = [
  { id: 'domingo', nome: 'Domingo à noite' },
  { id: 'sexta', nome: 'Sexta-feira' },
  { id: 'diario', nome: 'Todo dia, 21h' },
  { id: 'off', nome: 'Sem lembrete' },
];

export function Habitos() {
  const { estado, despachar } = useLoja();
  const { t, paleta } = useTema();

  const s = semana(estado);
  const { ativos, disponiveis } = desafios(estado);
  const historico = historicoDeSemanas(estado);
  const seguidas = semanasEmDia(estado);

  return (
    <View>
      <Hero>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BotaoVoltar aoTocar={() => despachar({ tipo: 'IR_PARA', tela: 'home' })} />
          <Txt tamanho={16} peso={600} cor={t.onHero} espacamento={-0.16}>
            Hábitos
          </Txt>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 20 }}>
          <Txt tamanho={48} peso={600} numerico cor={t.onHero} espacamento={-1.9} entrelinha={0.9}>
            {seguidas}
          </Txt>
          <Txt tamanho={12.5} cor={t.onHeroSoft} entrelinha={1.4} estilo={{ paddingBottom: 4 }}>
            {seguidas === 1 ? 'semana seguida' : 'semanas seguidas'}
            {'\n'}com registro em dia
          </Txt>
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            gap: 6,
            marginTop: 20,
          }}
        >
          {historico.map((w) => (
            <View key={w.rotulo} style={{ alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 38,
                  height: 30,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: t.heroLine,
                  backgroundColor: w.atingiu ? comAlfa(t.onHero, 18) : 'transparent',
                }}
              >
                <Txt tamanho={11} peso={600} numerico cor={t.onHero}>
                  {w.registros}/{w.meta}
                </Txt>
              </View>
              <Txt tamanho={10} peso={600} cor={t.onHeroSoft}>
                {w.rotulo}
              </Txt>
            </View>
          ))}
        </View>
      </Hero>

      <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 26, gap: 26 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <CartaoNumero
            rotulo="Registros nesta semana"
            valor={`${s.registros} de ${s.meta}`}
            nota={`meta: ${s.meta} por semana`}
          />
          <CartaoNumero
            rotulo={`Lançamentos em ${nomeDoMes(estado.hoje)}`}
            valor={String(semTransferencias(transacoesDoMes(estado)).length)}
            nota={`${estado.contexto.lancamentosMesAnterior} no mês anterior`}
            corValor={t.up}
          />
        </View>

        {/* ── Desafios ativos ── */}
        <View style={{ gap: 2 }}>
          <Txt tamanho={15} peso={600} estilo={{ marginBottom: 8 }}>
            Desafios desta semana
          </Txt>
          {ativos.map((d, i) => {
            const cor = resolverCor(categoria(d.categoriaId).cor, paleta);
            return (
              <View
                key={d.id}
                style={{
                  gap: 12,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: i < ativos.length - 1 ? t.lineSoft : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
                  <Disco path={categoria(d.categoriaId).icone} cor={cor} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt tamanho={13.5} peso={600}>
                      {d.nome}
                    </Txt>
                    <Txt tamanho={11.5} cor={t.inkSoft}>
                      {d.sub}
                    </Txt>
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
                      {d.pct}%
                    </Txt>
                  </View>
                </View>

                <Barra pct={d.pct} cor={cor} />

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <Txt tamanho={12.5} numerico cor={t.inkMuted}>
                    {d.progressoLabel}
                  </Txt>
                  <Toque
                    aoTocar={
                      d.completo
                        ? undefined
                        : () =>
                            despachar({
                              tipo: 'AVANCAR_DESAFIO',
                              desafioId: d.id,
                              automatico: d.automatico,
                              rotulo: d.nome,
                            })
                    }
                    rotuloAcessivel={d.acaoLabel}
                  >
                    <View
                      style={{
                        borderRadius: 999,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        backgroundColor: t.accentSoft,
                      }}
                    >
                      <Txt tamanho={12} peso={600} cor={t.accent}>
                        {d.acaoLabel}
                      </Txt>
                    </View>
                  </Toque>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Desafios opcionais ── */}
        {disponiveis.length > 0 ? (
          <View style={{ gap: 2 }}>
            <Txt tamanho={15} peso={600} estilo={{ marginBottom: 4 }}>
              Desafios opcionais
            </Txt>
            {disponiveis.map((d, i) => {
              const cor = resolverCor(categoria(d.categoriaId).cor, paleta);
              return (
                <View
                  key={d.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 11,
                    paddingVertical: 13,
                    borderBottomWidth: 1,
                    borderBottomColor: i < disponiveis.length - 1 ? t.lineSoft : 'transparent',
                  }}
                >
                  <Disco path={categoria(d.categoriaId).icone} cor={cor} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt tamanho={13.5} peso={600}>
                      {d.nome}
                    </Txt>
                    <Txt tamanho={11.5} cor={t.inkSoft}>
                      {d.subOff}
                    </Txt>
                  </View>
                  <Toque
                    aoTocar={() =>
                      despachar({ tipo: 'ACEITAR_DESAFIO', desafioId: d.id, nome: d.nome })
                    }
                    rotuloAcessivel={`Entrar em ${d.nome}`}
                  >
                    <View
                      style={{
                        borderRadius: 999,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        backgroundColor: t.accent,
                      }}
                    >
                      <Txt tamanho={12} peso={600} cor={t.onAccent}>
                        Entrar
                      </Txt>
                    </View>
                  </Toque>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* ── Ritual ── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: t.surfaceMuted,
            borderRadius: 16,
            paddingVertical: 15,
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Txt tamanho={13.5} peso={600}>
              Seu ritual
            </Txt>
            <Txt tamanho={12} cor={t.inkSoft} entrelinha={1.45}>
              {resumoDoRitual(estado)}
            </Txt>
          </View>
          <Toque
            aoTocar={() => despachar({ tipo: 'ABRIR_RITUAL' })}
            rotuloAcessivel="Ajustar ritual"
          >
            <View
              style={{
                borderWidth: 1,
                borderColor: t.lineInput,
                borderRadius: 999,
                paddingVertical: 8,
                paddingHorizontal: 14,
              }}
            >
              <Txt tamanho={12.5} peso={600}>
                Ajustar
              </Txt>
            </View>
          </Toque>
        </View>

        {/* ── Lembrete ── */}
        <View style={{ gap: 10 }}>
          <Txt tamanho={15} peso={600}>
            Lembrete de registro
          </Txt>
          <Txt tamanho={12} cor={t.inkSoft} entrelinha={1.45} estilo={{ marginTop: -4 }}>
            Escolha quando o app te lembra de colocar os gastos em dia.
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {LEMBRETES.map((l) => {
              const ativo = estado.lembrete === l.id;
              return (
                <Toque
                  key={l.id}
                  aoTocar={() => despachar({ tipo: 'LEMBRETE', id: l.id })}
                  rotuloAcessivel={l.nome}
                >
                  <View
                    style={{
                      borderRadius: 999,
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderWidth: 1,
                      borderColor: ativo ? t.accent : t.lineInput,
                      backgroundColor: ativo ? t.accent : t.surface,
                    }}
                  >
                    <Txt
                      tamanho={12.5}
                      peso={ativo ? 600 : 500}
                      cor={ativo ? t.onAccent : t.inkMuted}
                    >
                      {l.nome}
                    </Txt>
                  </View>
                </Toque>
              );
            })}
          </View>
        </View>

        {/* ── Dados ── */}
        <View style={{ gap: 10 }}>
          <Txt tamanho={15} peso={600}>
            Seus dados
          </Txt>
          <Txt tamanho={12} cor={t.inkSoft} entrelinha={1.45} estilo={{ marginTop: -4 }}>
            Tudo fica só neste aparelho. Nada é enviado para nenhum servidor.
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {estado.transacoes.length === 0 ? (
              <Toque
                aoTocar={() => despachar({ tipo: 'CARREGAR_DEMO' })}
                rotuloAcessivel="Carregar dados de exemplo"
              >
                <View
                  style={{
                    borderRadius: 999,
                    paddingVertical: 9,
                    paddingHorizontal: 15,
                    borderWidth: 1,
                    borderColor: t.lineInput,
                  }}
                >
                  <Txt tamanho={12.5} peso={600} cor={t.inkMuted}>
                    Carregar dados de exemplo
                  </Txt>
                </View>
              </Toque>
            ) : (
              // Destrutivo, mas com undo no toast em vez de modal de
              // confirmação — a mesma regra de apagar um lançamento.
              <Toque
                aoTocar={() => despachar({ tipo: 'APAGAR_DADOS' })}
                rotuloAcessivel="Apagar todos os dados"
              >
                <View
                  style={{
                    borderRadius: 999,
                    paddingVertical: 9,
                    paddingHorizontal: 15,
                    borderWidth: 1,
                    borderColor: t.down,
                  }}
                >
                  <Txt tamanho={12.5} peso={600} cor={t.down}>
                    Apagar todos os dados
                  </Txt>
                </View>
              </Toque>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
