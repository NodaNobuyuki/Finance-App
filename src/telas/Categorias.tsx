import React from 'react';
import { View } from 'react-native';
import { Barra, corDoNivel, Disco, Hero, Toque, Txt } from '../componentes/basicos';
import { Icone } from '../componentes/Icone';
import { categoriasPorTipo, icones } from '../dominio/categorias';
import { formatar } from '../dominio/dinheiro';
import { somaPorCategoria, totalEntradas } from '../dominio/saldo';
import { orcamento, orcamentosPorCategoria, transacoesDoMes } from '../estado/derivados';
import { useLoja } from '../estado/store';
import { comAlfa, resolverCor } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';

export function Categorias() {
  const { estado, despachar } = useLoja();
  const { t, paleta } = useTema();

  const doMes = transacoesDoMes(estado);
  const despesa = estado.abaCategorias === 'despesa';
  const editando = estado.editandoCategorias;
  const lista = categoriasPorTipo(estado.categorias, despesa ? 'despesa' : 'receita');

  // Transferência não é gasto nem ganho — `somaPorCategoria` já a ignora, e a
  // soma manual que estava aqui contava as duas pontas de um aporte como
  // movimento da categoria.
  const gastos = somaPorCategoria(doMes);
  const totalDe = (id: string) =>
    despesa
      ? (gastos[id] ?? 0)
      : totalEntradas(doMes.filter((tx) => tx.categoriaId === id));

  const orcamentos = new Map(orcamentosPorCategoria(estado).map((o) => [o.categoria.id, o]));
  const mes = orcamento(estado);

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
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Txt tamanho={16} peso={600} cor={t.onHero} espacamento={-0.16}>
            Categorias
          </Txt>

          {/* Modo explícito em vez de toque longo: gesto escondido não se
              descobre, e o toque simples já tem dono (abrir o extrato). */}
          <Toque
            aoTocar={() => despachar({ tipo: 'EDITAR_CATEGORIAS', ligado: !editando })}
            rotuloAcessivel={editando ? 'Concluir edição' : 'Editar categorias'}
          >
            <View
              style={{
                borderWidth: 1,
                borderColor: t.heroLine,
                backgroundColor: editando ? comAlfa(t.onHero, 18) : 'transparent',
                borderRadius: 999,
                paddingVertical: 5,
                paddingHorizontal: 12,
              }}
            >
              <Txt tamanho={11.5} peso={600} cor={t.onHero}>
                {editando ? 'Concluir' : 'Editar'}
              </Txt>
            </View>
          </Toque>
        </View>
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

        {despesa ? (
          <View
            style={{
              backgroundColor: t.surfaceMuted,
              borderRadius: 16,
              padding: 16,
              gap: 10,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <Txt tamanho={13} peso={600}>
                Orçamento do mês
              </Txt>
              {mes.semLimites ? null : (
                <Txt tamanho={12.5} peso={600} numerico cor={corDoNivel(mes.nivel, t)}>
                  {mes.pctReal}% usado
                </Txt>
              )}
            </View>

            {mes.semLimites ? (
              // Empty state com saída, não texto seco: o teto do mês é a soma
              // dos tetos das categorias, então o caminho é abrir uma delas.
              <Txt tamanho={12} cor={t.inkSoft} entrelinha={1.45}>
                Você ainda não definiu teto nenhum. Toque em Editar e escolha uma categoria para
                dizer quanto ela pode consumir no mês — o orçamento é a soma desses tetos.
              </Txt>
            ) : (
              <>
                <Barra pct={mes.pct} cor={corDoNivel(mes.nivel, t)} altura={10} />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <Txt tamanho={12.5} numerico cor={t.inkMuted}>
                    {formatar(mes.gasto)} de {formatar(mes.total)}
                  </Txt>
                  <Txt tamanho={11.5} cor={t.inkSoft}>
                    {mes.restanteLabel}
                  </Txt>
                </View>
              </>
            )}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {lista.map((cat) => {
            const orc = orcamentos.get(cat.id);
            return (
              // Tocar numa categoria abre o extrato já filtrado — a tela não é
              // só um painel de totais. Segurar abre a edição.
              <Toque
                key={cat.id}
                aoTocar={() => {
                  if (editando) {
                    despachar({ tipo: 'ABRIR_CATEGORIA', categoriaId: cat.id });
                    return;
                  }
                  despachar({ tipo: 'FILTRO_CATEGORIA', categoria: cat.id });
                  despachar({ tipo: 'FILTRO_CONTA', conta: 'todas' });
                  despachar({ tipo: 'IR_PARA', tela: 'extrato' });
                }}
                estilo={{ width: '31.5%' }}
                rotuloAcessivel={
                  editando ? `Editar ${cat.nome}` : `Ver lançamentos de ${cat.nome}`
                }
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
                    {formatar(totalDe(cat.id))}
                  </Txt>

                  {/* Com teto, o número deixa de ser um total solto e vira
                      "quanto ainda cabe" — que é a pergunta que a tela existe
                      para responder. */}
                  {orc ? (
                    <View style={{ alignSelf: 'stretch', gap: 5 }}>
                      <Barra pct={orc.pct} cor={corDoNivel(orc.nivel, t)} altura={5} />
                      <Txt tamanho={10} numerico cor={t.inkFaint} alinhamento="center">
                        de {formatar(orc.total)}
                      </Txt>
                    </View>
                  ) : null}
                </View>
              </Toque>
            );
          })}

          <Toque
            aoTocar={() =>
              despachar({
                tipo: 'ABRIR_CATEGORIA',
                tipoCategoria: despesa ? 'despesa' : 'receita',
              })
            }
            estilo={{ width: '31.5%' }}
            rotuloAcessivel="Nova categoria"
          >
            <View
              style={{
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
          </Toque>
        </View>
      </View>
    </View>
  );
}
