import React from 'react';
import { View } from 'react-native';
import { Barra, corDoNivel, Disco, Hero, Rotulo, Toque, Txt } from '../componentes/basicos';
import { Icone } from '../componentes/Icone';
import { ItemTransacao } from '../componentes/ItemTransacao';
import { useBackup } from '../dados/useBackup';
import { Vazio } from '../componentes/Vazio';
import { categoria, icones } from '../dominio/categorias';
import { DiaISO, rotuloMes } from '../dominio/datas';
import { comSinal, formatar, formatarRedondo } from '../dominio/dinheiro';
import { saldoDaConta } from '../dominio/saldo';
import {
  acaoDoDia,
  atalhosRapidos,
  DiaDaSemana,
  insights,
  lembreteDeBackup,
  orcamento,
  PagueSePrimeiroAgora,
  pagueSePrimeiroAgora,
  recorrencias,
  rotuloDoVencimento,
  resumoDoMes,
  semana,
  statusDoRegistro,
  transacoesDoMes,
} from '../estado/derivados';
import { PERCENTUAIS_PAGUE_SE_PRIMEIRO } from '../dominio/recorrencia';
import { Acao, useRecorte, useDespachar } from '../estado/store';
import { resolverCor } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';

/** O que esta tela lê do estado — e só isto a acorda. */
const CHAVES = [
  'perfil',
  'insightIdx',
  'contas',
  'mostrarSaldo',
  'categorias',
  'intencao',
  'semanaFechada',
  'ritualDiaFechamento',
  'hoje',
  'metaSemanal',
  'transacoes',
  'diasSemGasto',
  'ultimoBackupEm',
  'decisoesDeRecorrencia',
  'metas',
  'pagueSePrimeiro',
] as const;

export function Inicio() {
  const estado = useRecorte(CHAVES);
  const despachar = useDespachar();
  const backup = useBackup();
  const { t, paleta } = useTema();

  const s = semana(estado);
  const status = statusDoRegistro(estado);
  const mes = resumoDoMes(estado);
  const orc = orcamento(estado);
  const acao = acaoDoDia(estado);
  const listaInsights = insights(estado);
  const insight = listaInsights[estado.insightIdx % listaInsights.length];
  const recentes = transacoesDoMes(estado).slice(0, 5);
  const corOrcamento = corDoNivel(orc.nivel, t);
  const avisoDeBackup = lembreteDeBackup(estado);
  const rec = recorrencias(estado);
  const pagarPrimeiro = pagueSePrimeiroAgora(estado);

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
              const cat = categoria(estado.categorias, a.categoriaId);
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
        {/* Pague-se primeiro: o salário caiu, e é agora — antes do primeiro
            gasto — que guardar custa menos. Por isso vem antes de tudo. */}
        {pagarPrimeiro ? (
          <CartaoPagueSePrimeiro
            convite={pagarPrimeiro}
            hoje={estado.hoje}
            percentual={estado.pagueSePrimeiro.percentual}
            despachar={despachar}
          />
        ) : null}

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

          {/* Orçamento: a cor progride verde → amarelo → vermelho.
              Sem teto definido, o bloco não finge um número: vira o convite a
              definir o primeiro. Enquanto o teto era um campo que nenhuma ação
              escrevia, esta área anunciava "0% usado · R$ 0,00 de R$ 0,00",
              sempre verde, para toda instalação nova. */}
          <View style={{ gap: 8, paddingTop: 2 }}>
            {orc.semLimites ? (
              <Toque
                aoTocar={() => despachar({ tipo: 'IR_PARA', tela: 'categorias' })}
                rotuloAcessivel="Definir teto por categoria"
              >
                <View style={{ gap: 4 }}>
                  <Txt tamanho={12.5} peso={600}>
                    Definir orçamento
                  </Txt>
                  <Txt tamanho={11.5} cor={t.inkSoft} entrelinha={1.45}>
                    Dê um teto às categorias que você quer segurar. O orçamento do mês é a soma
                    deles.
                  </Txt>
                </View>
              </Toque>
            ) : (
              <>
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
              </>
            )}
          </View>
        </View>

        {/* Recorrentes: o que venceu vem com o lançar à mão — o previsível não
            precisa ser digitado. Sem nada vencido, a linha leva à tela, com a
            sugestão nova primeiro e o custo do comprometido depois. */}
        {rec.vencidas.length > 0 ? (
          <View
            style={{
              gap: 12,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: t.accent,
              paddingVertical: 14,
              paddingHorizontal: 16,
            }}
          >
            <Txt tamanho={10} peso={600} maiusculas espacamento={0.8} cor={t.accent}>
              Venceu
            </Txt>
            {rec.vencidas.slice(0, 3).map((r) => (
              <View key={r.chave} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt tamanho={13} peso={600} linhas={1}>
                    {r.descricao}
                  </Txt>
                  <Txt tamanho={11.5} numerico cor={t.inkSoft}>
                    {r.valorFixo ? '' : '≈ '}
                    {formatar(-r.valorCentavos)} · {rotuloDoVencimento(r.proxima, estado.hoje)}
                  </Txt>
                </View>
                <Toque
                  aoTocar={() => despachar({ tipo: 'LANCAR_RECORRENCIA', chave: r.chave })}
                  rotuloAcessivel={`Lançar ${r.descricao}`}
                >
                  <Txt tamanho={12.5} peso={600} cor={t.accent}>
                    Lançar
                  </Txt>
                </Toque>
              </View>
            ))}
          </View>
        ) : rec.sugeridas.length > 0 || rec.confirmadas.length > 0 ? (
          <Toque
            aoTocar={() => despachar({ tipo: 'IR_PARA', tela: 'recorrentes' })}
            rotuloAcessivel="Ver gastos recorrentes"
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: t.line,
                paddingVertical: 13,
                paddingHorizontal: 16,
              }}
            >
              <Icone path={icones.repetir} tamanho={18} cor={t.accent} espessura={1.8} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt tamanho={12.5} peso={600}>
                  {rec.sugeridas.length > 0
                    ? rec.sugeridas.length === 1
                      ? '1 gasto parece se repetir todo mês'
                      : `${rec.sugeridas.length} gastos parecem se repetir todo mês`
                    : `Recorrentes · ${formatar(rec.mensalCentavos)} por mês`}
                </Txt>
                <Txt tamanho={11.5} cor={t.inkSoft} entrelinha={1.4}>
                  {rec.sugeridas.length > 0
                    ? 'Confirme e o app avisa quando eles vencerem.'
                    : `${formatarRedondo(rec.investidoCentavos)} em 5 anos, se investido.`}
                </Txt>
              </View>
              <Txt tamanho={12.5} peso={600} cor={t.accent}>
                {rec.sugeridas.length > 0 ? 'Revisar' : 'Ver'}
              </Txt>
            </View>
          </Toque>
        ) : null}

        {/* Backup: só quando há o que perder. O toque já exporta — o aviso é
            o próprio caminho, não um recado que manda procurar em Hábitos. */}
        {avisoDeBackup ? (
          <Toque aoTocar={backup.exportar} rotuloAcessivel="Fazer backup agora">
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: t.line,
                paddingVertical: 13,
                paddingHorizontal: 16,
              }}
            >
              <Icone path={icones.baixar} tamanho={18} cor={t.accent} espessura={1.8} />
              <View style={{ flex: 1, gap: 2 }}>
                <Txt tamanho={12.5} peso={600}>
                  {avisoDeBackup.nunca
                    ? 'Nenhum backup ainda'
                    : `Último backup há ${avisoDeBackup.dias} dias`}
                </Txt>
                <Txt tamanho={11.5} cor={t.inkSoft} entrelinha={1.4}>
                  {avisoDeBackup.pendentes === 1
                    ? '1 lançamento existe só neste celular.'
                    : `${avisoDeBackup.pendentes} lançamentos existem só neste celular.`}
                </Txt>
              </View>
              <Txt tamanho={12.5} peso={600} cor={t.accent}>
                Fazer backup
              </Txt>
            </View>
          </Toque>
        ) : null}

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

/**
 * O convite de guardar quando a entrada recorrente cai — ou, antes disso, de
 * lançá-la, que é o que falta para quem registra à mão.
 *
 * O percentual troca aqui mesmo, no momento da decisão: "este mês só 5%" é
 * melhor que "agora não", e esconder a escolha numa tela de ajustes empurraria
 * a pessoa para o não. A meta de destino mora em Recorrentes.
 */
function CartaoPagueSePrimeiro({
  convite,
  hoje,
  percentual,
  despachar,
}: {
  convite: PagueSePrimeiroAgora;
  hoje: DiaISO;
  percentual: number;
  despachar: (a: Acao) => void;
}) {
  const { t } = useTema();
  const { entrada } = convite;
  const valorEntrada = `${entrada.valorFixo ? '' : '≈ '}${formatar(entrada.valorCentavos)}`;

  const botao = (rotulo: string, aoTocar: () => void) => (
    <Toque aoTocar={aoTocar} rotuloAcessivel={rotulo}>
      <View
        style={{
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: 'center',
          backgroundColor: t.accent,
        }}
      >
        <Txt tamanho={13} peso={600} cor={t.onAccent}>
          {rotulo}
        </Txt>
      </View>
    </Toque>
  );

  return (
    <View
      style={{
        gap: 14,
        borderRadius: 18,
        paddingVertical: 15,
        paddingHorizontal: 16,
        backgroundColor: t.accentSoft,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Disco path={icones.metas} cor={t.onAccent} fundo={t.accent} icone={19} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt tamanho={10} peso={600} maiusculas espacamento={0.8} cor={t.accent}>
            {convite.situacao === 'guardar'
              ? `${entrada.descricao} caiu · ${formatar(entrada.valorCentavos)}`
              : `Dia de ${entrada.descricao} · ${valorEntrada}`}
          </Txt>
          <Txt tamanho={13.5} peso={600}>
            {convite.situacao === 'guardar'
              ? 'Pague-se primeiro'
              : 'Já caiu? Lance para guardar antes de gastar'}
          </Txt>
          <Txt tamanho={11.5} cor={t.inkSoft} entrelinha={1.4}>
            {convite.situacao === 'lancar'
              ? `${maiuscula(rotuloDoVencimento(entrada.proxima, hoje))}. Assim que lançar, o app sugere guardar ${percentual}% antes de gastar.`
              : convite.meta
                ? `Guarde ${convite.percentual}% em ${convite.meta.nome} antes do primeiro gasto — depois, o que sobra é o que dá para gastar.`
                : `Guarde ${convite.percentual}% antes do primeiro gasto. Falta só uma meta para onde levar.`}
          </Txt>
        </View>
      </View>

      {convite.situacao === 'guardar' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 7 }}>
            {PERCENTUAIS_PAGUE_SE_PRIMEIRO.map((pct) => {
              const ativo = pct === convite.percentual;
              return (
                <Toque
                  key={pct}
                  aoTocar={() => despachar({ tipo: 'PAGAR_PRIMEIRO_PERCENTUAL', percentual: pct })}
                  rotuloAcessivel={`Guardar ${pct}%`}
                  estilo={{ flex: 1 }}
                >
                  <View
                    style={{
                      borderRadius: 999,
                      paddingVertical: 7,
                      alignItems: 'center',
                      borderWidth: 1,
                      borderColor: ativo ? t.accent : t.lineInput,
                      backgroundColor: ativo ? t.accent : t.surface,
                    }}
                  >
                    <Txt tamanho={12.5} peso={600} numerico cor={ativo ? t.onAccent : t.inkMuted}>
                      {pct}%
                    </Txt>
                  </View>
                </Toque>
              );
            })}
          </View>
          {convite.meta
            ? botao(`Guardar ${formatar(convite.valorCentavos)}`, () =>
                despachar({ tipo: 'PAGAR_PRIMEIRO', chave: entrada.chave }),
              )
            : botao('Criar uma meta', () => despachar({ tipo: 'ABRIR_META' }))}
          <Toque
            aoTocar={() => despachar({ tipo: 'PULAR_PAGAR_PRIMEIRO', chave: entrada.chave })}
            rotuloAcessivel="Agora não"
            estilo={{ alignSelf: 'center' }}
          >
            <Txt tamanho={12.5} peso={600} cor={t.inkMuted}>
              Agora não
            </Txt>
          </Toque>
        </>
      ) : (
        botao('Já caiu — lançar', () =>
          despachar({ tipo: 'LANCAR_RECORRENCIA', chave: entrada.chave }),
        )
      )}
    </View>
  );
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
