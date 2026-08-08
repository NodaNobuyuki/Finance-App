import React from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { BotaoPrincipal, Rotulo, Toque, Txt } from '../../componentes/basicos';
import { Icone } from '../../componentes/Icone';
import { Teclado } from '../../componentes/Teclado';
import { categoria, categoriasDespesa, categoriasReceita, icones } from '../../dominio/categorias';
import { deDigitos, formatar } from '../../dominio/dinheiro';
import * as seed from '../../dominio/seed';
import { useLoja } from '../../estado/store';
import { sans } from '../../tema/fontes';
import { comAlfa, resolverCor } from '../../tema/paletas';
import { useTema } from '../../tema/TemaContext';
import { Folha } from './Folha';

/**
 * Nova transação.
 *
 * Caminho crítico do produto: nenhuma chamada de rede acontece aqui. O
 * lançamento é escrito no estado local e confirmado na hora; sync é depois.
 */
export function NovaTransacao() {
  const { estado, despachar } = useLoja();
  const { t, paleta } = useTema();

  const r = estado.rascunho;
  const valor = deDigitos(r.digitos);
  const despesa = r.tipo === 'despesa';
  const corValor = valor === 0 ? t.inkFaint : despesa ? t.down : t.up;
  const chaves = despesa ? categoriasDespesa : categoriasReceita;

  const segmento = (rotulo: string, ativo: boolean, cor: string, aoTocar: () => void) => (
    <Toque aoTocar={aoTocar} estilo={{ flex: 1 }} rotuloAcessivel={rotulo}>
      <View
        style={{
          borderRadius: 9,
          paddingVertical: 9,
          alignItems: 'center',
          backgroundColor: ativo ? t.surface : 'transparent',
          elevation: ativo ? 1 : 0,
        }}
      >
        <Txt tamanho={13} peso={600} cor={cor}>
          {rotulo}
        </Txt>
      </View>
    </Toque>
  );

  return (
    <Folha titulo="Nova transação" aoFechar={() => despachar({ tipo: 'FECHAR_FOLHA' })}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 14 }}>
        <View
          style={{
            flexDirection: 'row',
            gap: 2,
            borderRadius: 12,
            backgroundColor: t.segment,
            padding: 3,
          }}
        >
          {segmento('Despesa', despesa, despesa ? t.down : t.inkMuted, () =>
            despachar({ tipo: 'RASCUNHO_TIPO', valor: 'despesa' }),
          )}
          {segmento('Receita', !despesa, !despesa ? t.up : t.inkMuted, () =>
            despachar({ tipo: 'RASCUNHO_TIPO', valor: 'receita' }),
          )}
        </View>

        <View style={{ alignItems: 'center', gap: 3 }}>
          <Rotulo>Valor</Rotulo>
          <Txt tamanho={42} peso={600} numerico cor={corValor} espacamento={-0.84} entrelinha={1.1}>
            {formatar(valor)}
          </Txt>

          {/* O laço de custo de oportunidade: sai do gasto direto para a simulação */}
          {despesa && valor > 0 ? (
            <Toque
              aoTocar={() => despachar({ tipo: 'SIMULAR_DO_RASCUNHO' })}
              estilo={{ marginTop: 6 }}
              rotuloAcessivel="Simular o custo de oportunidade deste valor"
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 999,
                  paddingVertical: 7,
                  paddingHorizontal: 13,
                  backgroundColor: t.accentSoft,
                }}
              >
                <Icone path={icones.grafico} tamanho={14} cor={t.accent} espessura={1.8} />
                <Txt tamanho={12} peso={600} cor={t.accent}>
                  Vale a pena? Simular
                </Txt>
              </View>
            </Toque>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 8 }}>
          <Rotulo>Categoria</Rotulo>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {chaves.map((id) => {
              const cat = categoria(id);
              const cor = resolverCor(cat.cor, paleta);
              const ativo = r.categoriaId === id;
              return (
                <Toque
                  key={id}
                  aoTocar={() => despachar({ tipo: 'RASCUNHO_CATEGORIA', categoriaId: id })}
                  estilo={{ width: '23%' }}
                  rotuloAcessivel={cat.nome}
                >
                  <View
                    style={{
                      borderRadius: 14,
                      paddingVertical: 9,
                      paddingHorizontal: 4,
                      alignItems: 'center',
                      gap: 6,
                      borderWidth: 1,
                      borderColor: ativo ? cor : t.line,
                      backgroundColor: ativo ? comAlfa(cor, 10) : t.surface,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: ativo ? cor : comAlfa(cor, 14),
                      }}
                    >
                      <Icone
                        path={cat.icone}
                        tamanho={16}
                        cor={ativo ? t.onAccent : cor}
                        espessura={1.7}
                      />
                    </View>
                    <Txt tamanho={10.5} peso={600} alinhamento="center" entrelinha={1.2} linhas={2}>
                      {cat.nome}
                    </Txt>
                  </View>
                </Toque>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Rotulo>Conta</Rotulo>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 7 }}
          >
            {seed.contas.map((c) => {
              const ativo = r.contaId === c.id;
              return (
                <Toque
                  key={c.id}
                  aoTocar={() => despachar({ tipo: 'RASCUNHO_CONTA', contaId: c.id })}
                  rotuloAcessivel={c.nome}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 7,
                      borderRadius: 999,
                      paddingVertical: 8,
                      paddingHorizontal: 13,
                      borderWidth: 1,
                      borderColor: ativo ? t.accent : t.line,
                      backgroundColor: ativo ? t.accent : t.surface,
                    }}
                  >
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        backgroundColor: ativo ? t.onAccent : resolverCor(c.cor, paleta),
                      }}
                    />
                    <Txt tamanho={12.5} peso={600} cor={ativo ? t.onAccent : t.inkMuted}>
                      {c.nome}
                    </Txt>
                  </View>
                </Toque>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ gap: 8 }}>
            <Rotulo>Data</Rotulo>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.lineInput,
                borderRadius: 12,
                paddingVertical: 11,
                paddingHorizontal: 13,
              }}
            >
              <Icone path={icones.calendario} tamanho={15} cor={t.inkSoft} />
              <Txt tamanho={13} peso={600}>
                Hoje
              </Txt>
            </View>
          </View>

          <View style={{ flex: 1, gap: 8 }}>
            <Rotulo>Descrição (opcional)</Rotulo>
            <TextInput
              value={r.descricao}
              onChangeText={(texto) => despachar({ tipo: 'RASCUNHO_DESCRICAO', texto })}
              placeholder="Ex.: mercado da semana"
              placeholderTextColor={t.inkFaint}
              style={[
                sans(400),
                {
                  backgroundColor: t.surface,
                  borderWidth: 1,
                  borderColor: t.lineInput,
                  borderRadius: 12,
                  paddingVertical: 11,
                  paddingHorizontal: 13,
                  fontSize: 13,
                  color: t.ink,
                },
              ]}
            />
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          backgroundColor: t.surface,
          borderTopWidth: 1,
          borderTopColor: t.line,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: 12,
          gap: 9,
        }}
      >
        <Teclado
          aoDigitar={(d) => despachar({ tipo: 'DIGITO', valor: d })}
          aoApagar={() => despachar({ tipo: 'APAGAR_DIGITO' })}
        />
        <BotaoPrincipal
          rotulo={valor === 0 ? 'Informe um valor' : despesa ? 'Salvar despesa' : 'Salvar receita'}
          fundo={valor === 0 ? t.lineInput : despesa ? t.down : t.up}
          desabilitado={valor === 0}
          aoTocar={() => despachar({ tipo: 'SALVAR_TRANSACAO' })}
        />
      </View>
    </Folha>
  );
}
