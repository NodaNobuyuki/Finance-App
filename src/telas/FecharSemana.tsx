import React from 'react';
import { View } from 'react-native';
import { BotaoPrincipal, BotaoVoltar, Hero, Rotulo, Toque, Txt } from '../componentes/basicos';
import { Icone } from '../componentes/Icone';
import { icones } from '../dominio/categorias';
import { rotuloDia } from '../dominio/datas';
import { formatar } from '../dominio/dinheiro';
import { diasRegistrados, semana } from '../estado/derivados';
import { useLoja } from '../estado/store';
import { useTema } from '../tema/TemaContext';
import { Passos } from './Resumo';

/**
 * Fechamento da semana em 3 passos:
 *   1. conferir os dias  →  2. ver o resumo (tela Resumo)  →  3. escolher um foco
 *
 * O passo 2 vive em `Resumo` porque é a mesma tela que a Home abre sozinha.
 */
export function FecharSemana() {
  const { estado, despachar } = useLoja();
  const { t } = useTema();

  const s = semana(estado);
  const passo = estado.fecharPasso;
  const registrados = diasRegistrados(estado);

  const intencoes = [
    { id: 'reg', nome: `Registrar ${s.meta}x na semana` },
    { id: 'delivery', nome: 'Menos delivery' },
    { id: 'impulso', nome: 'Nenhuma compra por impulso' },
    { id: 'cat', nome: 'Categorizar no mesmo dia' },
  ];

  /** Dias já vividos da semana, com o total gasto em cada um. */
  const diasParaConferir = s.dias
    .filter((d) => d.dia <= estado.hoje)
    .map((d) => {
      const total = estado.transacoes.reduce(
        (a, tx) =>
          tx.ocorridoEm === d.dia && tx.valorCentavos < 0 ? a + Math.abs(tx.valorCentavos) : a,
        0,
      );
      const registrado = registrados.has(d.dia);
      const [rotulo, data] = rotuloDia(d.dia, estado.hoje).split(' · ');
      return {
        dia: d.dia,
        rotulo,
        data: data ?? '',
        registrado,
        valorLabel: registrado ? (total > 0 ? formatar(total) : 'sem gasto') : 'em aberto',
      };
    });

  return (
    <View>
      <Hero>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BotaoVoltar aoTocar={() => despachar({ tipo: 'IR_PARA', tela: 'home' })} />
          <Txt tamanho={16} peso={600} cor={t.onHero} espacamento={-0.16} estilo={{ flex: 1 }}>
            Fechar a semana
          </Txt>
          <Passos atual={passo} />
        </View>

        <View style={{ gap: 7, marginTop: 18 }}>
          <Rotulo cor={t.onHeroSoft}>Passo {passo === 3 ? '3' : '1'} de 3</Rotulo>
          <Txt tamanho={26} peso={600} cor={t.onHero} espacamento={-0.78} entrelinha={1.1}>
            {passo === 3 ? 'Um foco para a próxima' : 'Confira os dias'}
          </Txt>
          <Txt tamanho={12.5} cor={t.onHeroSoft} entrelinha={1.45}>
            {passo === 3
              ? 'Escolher uma coisa só funciona melhor que tentar mudar tudo.'
              : s.pendentes.length === 0
                ? 'Todos os dias desta semana estão registrados.'
                : s.pendentes.length === 1
                  ? '1 dia ainda está em aberto.'
                  : `${s.pendentes.length} dias ainda estão em aberto.`}
          </Txt>
        </View>
      </Hero>

      {passo === 3 ? (
        <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 26, gap: 22 }}>
          <View style={{ gap: 8 }}>
            {intencoes.map((i) => {
              const ativa = estado.intencaoSel === i.id;
              return (
                <Toque
                  key={i.id}
                  aoTocar={() => despachar({ tipo: 'FECHAR_INTENCAO', id: i.id, nome: i.nome })}
                  rotuloAcessivel={i.nome}
                >
                  <View
                    style={{
                      borderRadius: 14,
                      paddingVertical: 14,
                      paddingHorizontal: 16,
                      borderWidth: 1,
                      borderColor: ativa ? t.accent : t.lineInput,
                      backgroundColor: ativa ? t.accent : t.surface,
                    }}
                  >
                    <Txt
                      tamanho={13.5}
                      peso={ativa ? 600 : 500}
                      cor={ativa ? t.onAccent : t.inkMuted}
                    >
                      {i.nome}
                    </Txt>
                  </View>
                </Toque>
              );
            })}
          </View>

          <BotaoPrincipal
            rotulo="Concluir a semana"
            aoTocar={() => despachar({ tipo: 'FECHAR_CONCLUIR' })}
          />
          <Txt tamanho={11.5} cor={t.inkFaint} alinhamento="center" entrelinha={1.5}>
            Você pode fechar sem escolher um foco.
          </Txt>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 22, paddingTop: 22, paddingBottom: 26, gap: 22 }}>
          <View style={{ gap: 2 }}>
            {diasParaConferir.map((d) => (
              <View
                key={d.dia}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 13,
                  borderBottomWidth: 1,
                  borderBottomColor: t.lineSoft,
                }}
              >
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: d.registrado ? t.up : t.atencao,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {d.registrado ? (
                    <Icone path={icones.check} tamanho={13} cor={t.up} espessura={3} />
                  ) : null}
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <Txt tamanho={13.5} peso={500}>
                    {d.rotulo}
                  </Txt>
                  <Txt tamanho={11} cor={t.inkFaint}>
                    {d.data}
                  </Txt>
                </View>
                <Txt tamanho={13} peso={600} numerico cor={d.registrado ? t.ink : t.atencao}>
                  {d.valorLabel}
                </Txt>
              </View>
            ))}
          </View>

          <BotaoPrincipal
            rotulo={
              s.pendentes.length === 0
                ? 'Ver o resumo'
                : s.pendentes.length === 1
                  ? 'Lançar 1 dia em aberto'
                  : `Lançar ${s.pendentes.length} dias em aberto`
            }
            aoTocar={() =>
              s.pendentes.length
                ? despachar({ tipo: 'IR_PARA', tela: 'lote' })
                : despachar({ tipo: 'IR_RESUMO', fechando: true })
            }
          />
        </View>
      )}
    </View>
  );
}
