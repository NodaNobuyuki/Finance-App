import React from 'react';
import { View } from 'react-native';
import { Barra, Disco, Hero, Rotulo, Toque, Txt } from '../componentes/basicos';
import { Icone } from '../componentes/Icone';
import { ItemTransacao } from '../componentes/ItemTransacao';
import { Vazio } from '../componentes/Vazio';
import { categoria, icones } from '../dominio/categorias';
import { rotuloMes } from '../dominio/datas';
import { comSinal, formatar, formatarRedondo } from '../dominio/dinheiro';
import { saldoDaConta } from '../dominio/saldo';
import {
  acaoDoDia,
  atalhosRapidos,
  DiaDaSemana,
  insights,
  orcamento,
  resumoDoMes,
  semana,
  statusDoRegistro,
  transacoesDoMes,
} from '../estado/derivados';
import { useLoja } from '../estado/store';
import { resolverCor } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';

export function Inicio() {
  const { estado, despachar } = useLoja();
  const { t, paleta } = useTema();

  const s = semana(estado);
  const status = statusDoRegistro(estado);
  const mes = resumoDoMes(estado);
  const orc = orcamento(estado);
  const acao = acaoDoDia(estado);
  const listaInsights = insights(estado);
  const insight = listaInsights[estado.insightIdx % listaInsights.length];
  const recentes = transacoesDoMes(estado).slice(0, 5);
  const corOrcamento = orc.nivel === 'ok' ? t.up : orc.nivel === 'atencao' ? t.atencao : t.down;

  /** Um quadradinho da trilha da semana. */
  const celulaDoDia = (d: DiaDaSemana) => {
    const registrado = d.estado === 'registrado';
    const futuro = d.estado === 'futuro';
    const borda =
      registrado || d.estado === 'hoje-aberto' ? t.onHero : futuro ? t.heroLine : t.atencao;

    const aoTocar =
      registrado || futuro
        ? undefined
        : d.ehHoje
          ? () => despachar({ tipo: 'ABRIR_NOVA' })
          : () => despachar({ tipo: 'IR_PARA', tela: 'lote' });

    return (
      <Toque
        key={d.dia}
        aoTocar={aoTocar}
        estilo={{ flex: 1, opacity: futuro ? 0.42 : 1 }}
        rotuloAcessivel={`${d.dia} ${registrado ? 'registrado' : 'em aberto'}`}
      >
        <View style={{ alignItems: 'center', gap: 7 }}>
          <Txt
            tamanho={10}
            peso={d.ehHoje ? 700 : 500}
            espacamento={0.5}
            cor={d.ehHoje ? t.onHero : t.onHeroSoft}
          >
            {d.letra}
          </Txt>
          <View
            style={{
              width: '100%',
              height: 32,
              borderRadius: 10,
              borderWidth: d.ehHoje && !registrado ? 2 : 1,
              borderColor: borda,
              backgroundColor: registrado ? t.onHero : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {registrado ? (
              <Icone path={icones.check} tamanho={14} cor={t.hero} espessura={2.6} />
            ) : null}
          </View>
        </View>
      </Toque>
    );
  };

  return (
    <View>
      {/* ── Topo: estado do registro ── */}
      <Hero>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Txt tamanho={16} peso={600} cor={t.onHero} espacamento={-0.16}>
            {estado.perfil.nome ? `Olá, ${estado.perfil.nome}` : 'Olá'}
          </Txt>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: t.heroLine,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt tamanho={12.5} peso={600} cor={t.onHero}>
              {estado.perfil.nome.trim().charAt(0).toUpperCase() || '—'}
            </Txt>
          </View>
        </View>

        <View style={{ gap: 16, marginTop: 22 }}>
          <View style={{ gap: 6 }}>
            <Rotulo cor={t.onHeroSoft}>Seu registro</Rotulo>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
              <View
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 999,
                  backgroundColor: status.emDia ? t.toastCheck : t.atencao,
                }}
              />
              <Txt tamanho={30} peso={600} cor={t.onHero} espacamento={-0.9} entrelinha={1.05}>
                {status.titulo}
              </Txt>
            </View>
            <Txt tamanho={12} cor={t.onHeroSoft}>
              {status.sub}
            </Txt>
          </View>

          <View style={{ gap: 9 }}>
            <View style={{ flexDirection: 'row', gap: 6 }}>{s.dias.map(celulaDoDia)}</View>
            <Txt tamanho={11.5} cor={t.onHeroSoft}>
              {s.registros} de {s.meta} registros nesta semana
            </Txt>
          </View>
        </View>

        {/* ── Registro em um toque ── */}
        <View style={{ gap: 10, marginTop: 22 }}>
          <Rotulo cor={t.onHeroSoft}>Registro em um toque</Rotulo>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {atalhosRapidos(estado).map((a) => {
              const cat = categoria(a.categoriaId);
              return (
                <Toque
                  key={a.categoriaId}
                  aoTocar={() =>
                    despachar({
                      tipo: 'REGISTRO_RAPIDO',
                      categoriaId: a.categoriaId,
                      valorCentavos: a.valorCentavos,
                    })
                  }
                  estilo={{ width: '48.5%' }}
                  rotuloAcessivel={`Registrar ${cat.nome} de ${formatar(a.valorCentavos)}`}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      borderWidth: 1,
                      borderColor: t.heroLine,
                      borderRadius: 14,
                      paddingVertical: 9,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Icone path={cat.icone} tamanho={16} cor={t.onHeroSoft} />
                    <View style={{ flex: 1, gap: 1 }}>
                      <Txt tamanho={12} peso={500} cor={t.onHero} linhas={1} entrelinha={1.25}>
                        {cat.nome}
                      </Txt>
                      <Txt tamanho={13} peso={600} numerico cor={t.onHero} entrelinha={1.15}>
                        {formatarRedondo(a.valorCentavos)}
                      </Txt>
                    </View>
                  </View>
                </Toque>
              );
            })}

            <Toque
              aoTocar={() => despachar({ tipo: 'ABRIR_NOVA' })}
              estilo={{ width: '100%' }}
              rotuloAcessivel="Registrar outro valor"
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: t.heroLine,
                  borderRadius: 14,
                  paddingVertical: 9,
                  paddingHorizontal: 14,
                }}
              >
                <Icone path={icones.mais} tamanho={14} cor={t.onHeroSoft} espessura={1.8} />
                <Txt tamanho={12.5} peso={500} cor={t.onHeroSoft}>
                  Outro
                </Txt>
              </View>
            </Toque>
          </View>
        </View>
      </Hero>

      {/* ── Corpo ── */}
      <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 26, gap: 26 }}>
        {/* Insight rotativo */}
        <Toque
          aoTocar={() => despachar({ tipo: 'PROXIMO_INSIGHT', total: listaInsights.length })}
          rotuloAcessivel="Próximo insight"
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderRadius: 18,
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: t.accentSoft,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: t.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icone path={icones.lampada} tamanho={17} cor={t.accent} espessura={1.7} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Txt tamanho={10} peso={600} maiusculas espacamento={0.8} cor={t.accent}>
                {insight.tag}
              </Txt>
              <Txt tamanho={13} peso={500} entrelinha={1.4}>
                {insight.texto}
              </Txt>
            </View>
            <View style={{ gap: 4 }}>
              {listaInsights.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 999,
                    backgroundColor:
                      estado.insightIdx % listaInsights.length === i ? t.accent : t.lineInput,
                  }}
                />
              ))}
            </View>
          </View>
        </Toque>

        {/* Card de ação: o convite do ciclo semanal */}
        <View
          style={{
            gap: 14,
            borderRadius: 18,
            paddingVertical: 15,
            paddingHorizontal: 16,
            backgroundColor: acao.variante === 'convite' ? t.accentSoft : t.surfaceMuted,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Disco path={icones[acao.icone]} cor={t.onAccent} fundo={t.accent} icone={19} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt tamanho={13.5} peso={600}>
                {acao.titulo}
              </Txt>
              <Txt tamanho={11.5} cor={t.inkSoft} entrelinha={1.4}>
                {acao.sub}
              </Txt>
            </View>
          </View>
          <Toque
            aoTocar={() =>
              acao.destino === 'fechar'
                ? despachar({ tipo: 'FECHAR_INICIAR' })
                : acao.destino === 'resumo'
                  ? despachar({ tipo: 'IR_RESUMO', fechando: false })
                  : despachar({ tipo: 'IR_PARA', tela: 'lote' })
            }
            rotuloAcessivel={acao.botao}
          >
            <View
              style={{
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                backgroundColor: t.accent,
              }}
            >
              <Txt tamanho={13} peso={600} cor={t.onAccent}>
                {acao.botao}
              </Txt>
            </View>
          </Toque>
        </View>

        {/* Contas — saldo derivado das transações, nunca guardado */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {estado.contas.map((c) => {
            const saldo = saldoDaConta(c, estado.transacoes);
            return (
              // Tocar a conta abre a edição — é o único lugar em que ela
              // aparece, então é daqui que se renomeia e se apaga.
              <Toque
                key={c.id}
                aoTocar={() => despachar({ tipo: 'ABRIR_CONTA', contaId: c.id })}
                rotuloAcessivel={`Editar ${c.nome}`}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: t.surfaceMuted,
                    borderRadius: 999,
                    paddingVertical: 6,
                    paddingHorizontal: 11,
                  }}
                >
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      backgroundColor: resolverCor(c.cor, paleta),
                    }}
                  />
                  <Txt tamanho={11.5} peso={500} cor={t.inkMuted}>
                    {c.nome}
                  </Txt>
                  <Txt tamanho={11.5} peso={600} numerico cor={saldo < 0 ? t.down : t.ink}>
                    {estado.mostrarSaldo
                      ? saldo < 0
                        ? `− ${formatar(saldo)}`
                        : formatar(saldo)
                      : '••••'}
                  </Txt>
                </View>
              </Toque>
            );
          })}

          {/* Transferir só faz sentido com duas contas — com uma, não há para
              onde mover. */}
          {estado.contas.length > 1 ? (
            <Toque
              aoTocar={() => despachar({ tipo: 'ABRIR_TRANSFERENCIA' })}
              rotuloAcessivel="Transferir entre contas"
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  borderRadius: 999,
                  backgroundColor: t.surfaceMuted,
                  paddingVertical: 6,
                  paddingHorizontal: 11,
                }}
              >
                <Icone path={icones.transferir} tamanho={13} cor={t.inkSoft} espessura={1.8} />
                <Txt tamanho={11.5} peso={600} cor={t.inkSoft}>
                  Transferir
                </Txt>
              </View>
            </Toque>
          ) : null}

          <Toque aoTocar={() => despachar({ tipo: 'ABRIR_CONTA' })} rotuloAcessivel="Nova conta">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                borderRadius: 999,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: t.lineInput,
                paddingVertical: 6,
                paddingHorizontal: 11,
              }}
            >
              <Icone path={icones.mais} tamanho={13} cor={t.inkSoft} espessura={2} />
              <Txt tamanho={11.5} peso={600} cor={t.inkSoft}>
                Nova conta
              </Txt>
            </View>
          </Toque>
        </View>

        {/* Resumo do mês */}
        <View style={{ gap: 14 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
            }}
          >
            <Txt tamanho={15} peso={600}>
              {rotuloMes(estado.hoje)}
            </Txt>
            <Txt tamanho={12.5} peso={600} numerico cor={mes.resultado >= 0 ? t.up : t.down}>
              {comSinal(mes.resultado)}
            </Txt>
          </View>

          <View style={{ gap: 13 }}>
            <View style={{ gap: 6 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                }}
              >
                <Txt tamanho={12.5} cor={t.inkMuted}>
                  Receitas
                </Txt>
                <Txt tamanho={14} peso={600} numerico cor={t.up}>
                  {formatar(mes.receitas)}
                </Txt>
              </View>
              <Barra pct={mes.pctReceitas} cor={t.up} />
            </View>

            <View style={{ gap: 6 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                }}
              >
                <Txt tamanho={12.5} cor={t.inkMuted}>
                  Despesas
                </Txt>
                <Txt tamanho={14} peso={600} numerico cor={t.down}>
                  {formatar(mes.despesas)}
                </Txt>
              </View>
              <Barra pct={mes.pctDespesas} cor={t.down} />
            </View>
          </View>

          {/* Orçamento: a cor progride verde → amarelo → vermelho */}
          <View style={{ gap: 8, paddingTop: 2 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <Txt tamanho={12.5} cor={t.inkMuted}>
                Orçamento do mês
              </Txt>
              <Txt tamanho={12.5} peso={600} numerico cor={corOrcamento}>
                {orc.pctReal}% usado
              </Txt>
            </View>
            <Barra pct={orc.pct} cor={corOrcamento} altura={10} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <Txt tamanho={12.5} numerico cor={t.inkMuted}>
                {formatar(orc.gasto)} de {formatar(orc.total)}
              </Txt>
              <Txt tamanho={11.5} cor={t.inkSoft}>
                {orc.restanteLabel}
              </Txt>
            </View>
          </View>
        </View>

        {/* Últimas transações */}
        <View style={{ gap: 4 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <Txt tamanho={15} peso={600}>
              Últimas transações
            </Txt>
            <Toque
              aoTocar={() => despachar({ tipo: 'IR_PARA', tela: 'extrato' })}
              rotuloAcessivel="Ver todas as transações"
            >
              <Txt tamanho={12.5} peso={600} cor={t.accent}>
                Ver tudo
              </Txt>
            </Toque>
          </View>
          {recentes.length > 0 ? (
            recentes.map((tx, i) => (
              <ItemTransacao key={tx.id} tx={tx} separador={i < recentes.length - 1} />
            ))
          ) : (
            <Vazio
              compacto
              icone={icones.extrato}
              titulo="Nenhum lançamento ainda"
              texto="Registre o primeiro gasto — leva menos de dez segundos."
              acao={{
                rotulo: 'Registrar agora',
                aoTocar: () => despachar({ tipo: 'ABRIR_NOVA' }),
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}
