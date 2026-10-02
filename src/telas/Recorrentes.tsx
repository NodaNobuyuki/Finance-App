import React, { useMemo } from 'react';
import { View } from 'react-native';
import { BotaoVoltar, Hero, Rotulo, Toque, Txt } from '../componentes/basicos';
import { Vazio } from '../componentes/Vazio';
import { icones } from '../dominio/categorias';
import { DiaISO } from '../dominio/datas';
import { formatar, formatarRedondo } from '../dominio/dinheiro';
import { RecorrenciaVista, recorrencias, rotuloDoVencimento } from '../estado/derivados';
import { useDespachar, useRecorte } from '../estado/store';
import { useImportarExtrato } from '../ingestao/useImportarExtrato';
import { useTema } from '../tema/TemaContext';

/** O que esta tela lê do estado — e só isto a acorda. */
const CHAVES = ['transacoes', 'hoje', 'decisoesDeRecorrencia'] as const;

/**
 * Gastos que se repetem todo mês.
 *
 * Duas coisas que a pessoa faz aqui: dizer se o que o app achou é mesmo
 * recorrente, e ver quanto o comprometido custa — no ano e investido. É o loop
 * de custo de oportunidade aplicado ao gasto que ninguém mais olha.
 */
export function Recorrentes() {
  const estado = useRecorte(CHAVES);
  const despachar = useDespachar();
  const importar = useImportarExtrato();
  const { t } = useTema();
  const r = useMemo(() => recorrencias(estado), [estado]);
  const vazio = r.confirmadas.length === 0 && r.sugeridas.length === 0;

  return (
    <View>
      <Hero>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BotaoVoltar aoTocar={() => despachar({ tipo: 'IR_PARA', tela: 'home' })} />
          <Txt tamanho={16} peso={600} cor={t.onHero} espacamento={-0.16} estilo={{ flex: 1 }}>
            Recorrentes
          </Txt>
        </View>

        <View style={{ gap: 6, marginTop: 18 }}>
          <Txt tamanho={11.5} cor={t.onHeroSoft}>
            Comprometido todo mês
          </Txt>
          <Txt tamanho={34} peso={600} numerico cor={t.onHero} espacamento={-1.02}>
            {formatar(r.mensalCentavos)}
          </Txt>
          <Txt tamanho={12} cor={t.onHeroSoft} entrelinha={1.45}>
            {r.confirmadas.length > 0
              ? `${formatarRedondo(r.anualCentavos)} no ano. Investido no CDI, viraria ${formatarRedondo(r.investidoCentavos)} em 5 anos.`
              : 'Confirme os gastos que se repetem para ver quanto eles custam no ano.'}
          </Txt>
        </View>
      </Hero>

      <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 26, gap: 26 }}>
        {vazio ? (
          <Vazio
            icone={icones.repetir}
            titulo="Nenhum gasto repetido ainda"
            texto="Assinaturas e contas fixas aparecem aqui depois de dois meses de lançamentos. Importar extratos antigos adianta isso."
            acao={{ rotulo: 'Importar extrato', aoTocar: importar }}
          />
        ) : null}

        {r.sugeridas.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Rotulo>Parecem se repetir</Rotulo>
            {r.sugeridas.map((item) => (
              <Cartao key={item.chave} item={item} hoje={estado.hoje}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Botao
                    rotulo="É recorrente"
                    destaque
                    aoTocar={() =>
                      despachar({
                        tipo: 'DECIDIR_RECORRENCIA',
                        chave: item.chave,
                        decisao: 'confirmada',
                      })
                    }
                  />
                  <Botao
                    rotulo="Não é"
                    aoTocar={() =>
                      despachar({
                        tipo: 'DECIDIR_RECORRENCIA',
                        chave: item.chave,
                        decisao: 'ignorada',
                      })
                    }
                  />
                </View>
              </Cartao>
            ))}
          </View>
        ) : null}

        {r.confirmadas.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Rotulo>Confirmadas</Rotulo>
            {r.confirmadas.map((item) => (
              <Cartao key={item.chave} item={item} hoje={estado.hoje}>
                <Txt tamanho={11.5} cor={t.inkSoft} entrelinha={1.4}>
                  {formatarRedondo(item.anualCentavos)} no ano ·{' '}
                  {formatarRedondo(item.investidoCentavos)} em 5 anos, se investido
                </Txt>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {item.vencida ? (
                    <Botao
                      rotulo="Lançar"
                      destaque
                      aoTocar={() => despachar({ tipo: 'LANCAR_RECORRENCIA', chave: item.chave })}
                    />
                  ) : null}
                  <Botao
                    rotulo="Parar de acompanhar"
                    aoTocar={() =>
                      despachar({
                        tipo: 'DECIDIR_RECORRENCIA',
                        chave: item.chave,
                        decisao: 'ignorada',
                      })
                    }
                  />
                </View>
              </Cartao>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function Cartao({
  item,
  hoje,
  children,
}: {
  item: RecorrenciaVista;
  hoje: DiaISO;
  children: React.ReactNode;
}) {
  const { t } = useTema();
  return (
    <View
      style={{
        gap: 10,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: item.vencida ? t.accent : t.line,
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
        <Txt tamanho={14} peso={600} estilo={{ flex: 1 }} linhas={1}>
          {item.descricao}
        </Txt>
        <Txt tamanho={14} peso={600} numerico cor={t.down}>
          {item.valorFixo ? '' : '≈ '}
          {formatar(-item.valorCentavos)}
        </Txt>
      </View>
      <Txt tamanho={11.5} cor={item.vencida ? t.accent : t.inkMuted}>
        Todo dia {Number(item.proxima.slice(8))} · {item.ocorrencias} meses seguidos ·{' '}
        {rotuloDoVencimento(item.proxima, hoje)}
      </Txt>
      {children}
    </View>
  );
}

function Botao({
  rotulo,
  destaque = false,
  aoTocar,
}: {
  rotulo: string;
  destaque?: boolean;
  aoTocar: () => void;
}) {
  const { t } = useTema();
  return (
    <Toque aoTocar={aoTocar} rotuloAcessivel={rotulo}>
      <View
        style={{
          borderRadius: 999,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: destaque ? t.accent : t.lineInput,
          backgroundColor: destaque ? t.accent : 'transparent',
        }}
      >
        <Txt tamanho={12.5} peso={600} cor={destaque ? t.onAccent : t.inkMuted}>
          {rotulo}
        </Txt>
      </View>
    </Toque>
  );
}
