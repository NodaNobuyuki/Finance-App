import React from 'react';
import { View } from 'react-native';
import { BotaoPrincipal, Toque, Txt } from '../../componentes/basicos';
import { Teclado } from '../../componentes/Teclado';
import { deDigitos, formatar } from '../../dominio/dinheiro';
import { metas } from '../../estado/derivados';
import { useLoja } from '../../estado/store';
import { useTema } from '../../tema/TemaContext';
import { Folha } from './Folha';

/** Atalhos de aporte, em centavos. */
const ATALHOS = [5000, 10000, 20000];

export function Aporte({ metaId }: { metaId: string }) {
  const { estado, despachar } = useLoja();
  const { t } = useTema();

  const meta = metas(estado).find((m) => m.id === metaId);
  const valor = deDigitos(estado.rascunho.digitos);

  // Guardar é transferência: sai de uma conta e entra na conta da meta. A folha
  // mostra as duas pontas porque o saldo da origem vai cair de verdade — antes
  // isto não movia dinheiro nenhum e o número na tela não queria dizer nada.
  const origem = estado.contas.find((c) => c.id === estado.rascunho.contaId);
  const destino = estado.contas.find((c) => c.id === meta?.contaId);
  const mesmaConta = origem !== undefined && origem.id === destino?.id;

  return (
    <Folha titulo="Adicionar à meta" aoFechar={() => despachar({ tipo: 'FECHAR_FOLHA' })}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 22, paddingHorizontal: 16 }}>
        <View style={{ alignItems: 'center', gap: 5 }}>
          <Txt tamanho={13} cor={t.inkMuted}>
            {meta?.nome ?? ''}
          </Txt>
          <Txt
            tamanho={42}
            peso={600}
            numerico
            entrelinha={1.1}
            espacamento={-0.84}
            cor={valor === 0 ? t.inkFaint : t.up}
          >
            {formatar(valor)}
          </Txt>
          <Txt tamanho={11.5} cor={t.inkFaint}>
            {meta ? `faltam ${formatar(meta.faltamCentavos)} para a meta` : ''}
          </Txt>
        </View>

        <View style={{ gap: 9 }}>
          <Txt tamanho={11} peso={600} cor={t.inkMuted} alinhamento="center" espacamento={0.5}>
            SAI DE
          </Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
            {estado.contas.map((c) => {
              const ativa = c.id === estado.rascunho.contaId;
              return (
                <Toque
                  key={c.id}
                  aoTocar={() => despachar({ tipo: 'RASCUNHO_CONTA', contaId: c.id })}
                  rotuloAcessivel={`Guardar a partir de ${c.nome}`}
                >
                  <View
                    style={{
                      borderRadius: 999,
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderWidth: 1,
                      borderColor: ativa ? t.accent : t.lineInput,
                      backgroundColor: ativa ? t.accent : t.surface,
                    }}
                  >
                    <Txt tamanho={12.5} peso={600} cor={ativa ? t.onAccent : t.inkMuted}>
                      {c.nome}
                    </Txt>
                  </View>
                </Toque>
              );
            })}
          </View>

          <Txt tamanho={11.5} cor={t.inkFaint} alinhamento="center" entrelinha={1.45}>
            {destino === undefined
              ? 'Esta meta ainda não tem onde guardar.'
              : mesmaConta
                ? `Fica em ${destino.nome} — o dinheiro já está lá, o saldo não muda.`
                : `Vai para ${destino.nome}. O saldo de ${origem?.nome ?? 'origem'} cai.`}
          </Txt>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {ATALHOS.map((centavos) => (
            <Toque
              key={centavos}
              aoTocar={() => despachar({ tipo: 'DEFINIR_DIGITOS', digitos: String(centavos) })}
              rotuloAcessivel={`Adicionar ${formatar(centavos)}`}
            >
              <View
                style={{
                  borderRadius: 999,
                  paddingVertical: 8,
                  paddingHorizontal: 15,
                  backgroundColor: t.accentSoft,
                }}
              >
                <Txt tamanho={12.5} peso={600} cor={t.accent}>
                  R$ {centavos / 100}
                </Txt>
              </View>
            </Toque>
          ))}
        </View>
      </View>

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
          rotulo={valor === 0 ? 'Informe um valor' : `Adicionar ${formatar(valor)}`}
          fundo={valor === 0 ? t.lineInput : t.accent}
          desabilitado={valor === 0}
          aoTocar={() => despachar({ tipo: 'CONFIRMAR_APORTE' })}
        />
      </View>
    </Folha>
  );
}
