import React from 'react';
import { View } from 'react-native';
import { BotaoPrincipal, Toque, Txt } from '../../componentes/basicos';
import { Teclado } from '../../componentes/Teclado';
import { deDigitos, formatar } from '../../dominio/dinheiro';
import { metas } from '../../estado/derivados';
import { useLoja } from '../../estado/store';
import { useTema } from '../../tema/TemaContext';
import { Folha } from './Folha';
import { PilulasDeConta } from './PilulasDeConta';

/** Atalhos de valor, em centavos. */
const ATALHOS = [5000, 10000, 20000];

/**
 * Guardar numa meta e retirar dela — o mesmo movimento nos dois sentidos.
 *
 * Uma folha só porque é uma transferência só: muda qual ponta é a conta da
 * meta. Guardar sai da conta escolhida e entra na conta da meta; retirar faz o
 * contrário. Sem o caminho de volta, quem guardasse por engano ficaria preso
 * assim que o toast de desfazer sumisse.
 */
export function MovimentoMeta({ metaId, retirar }: { metaId: string; retirar: boolean }) {
  const { estado, despachar } = useLoja();
  const { t } = useTema();

  const meta = metas(estado).find((m) => m.id === metaId);
  const valor = deDigitos(estado.rascunho.digitos);

  const contaDaMeta = estado.contas.find((c) => c.id === meta?.contaId);
  const escolhida = estado.contas.find((c) => c.id === estado.rascunho.contaId);
  const mesmaConta = escolhida !== undefined && escolhida.id === contaDaMeta?.id;

  const guardado = meta?.guardadoCentavos ?? 0;
  const demais = retirar && valor > guardado;
  const podeConfirmar = valor > 0 && !demais && contaDaMeta !== undefined;

  const explicacao = () => {
    if (contaDaMeta === undefined) return 'Esta meta ainda não tem onde guardar.';
    if (mesmaConta) {
      return retirar
        ? `Sai de ${contaDaMeta.nome} e volta para ela — o dinheiro não se move, só deixa de estar reservado.`
        : `Fica em ${contaDaMeta.nome} — o dinheiro já está lá, o saldo não muda.`;
    }
    return retirar
      ? `Sai de ${contaDaMeta.nome} e volta para ${escolhida?.nome ?? 'a conta'}.`
      : `Vai para ${contaDaMeta.nome}. O saldo de ${escolhida?.nome ?? 'origem'} cai.`;
  };

  return (
    <Folha
      titulo={retirar ? 'Retirar da meta' : 'Adicionar à meta'}
      aoFechar={() => despachar({ tipo: 'FECHAR_FOLHA' })}
    >
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
            cor={valor === 0 ? t.inkFaint : demais ? t.down : retirar ? t.ink : t.up}
          >
            {formatar(valor)}
          </Txt>
          <Txt tamanho={11.5} cor={demais ? t.down : t.inkFaint} alinhamento="center">
            {!meta
              ? ''
              : demais
                ? `só há ${formatar(guardado)} guardados`
                : retirar
                  ? `${formatar(guardado)} guardados nesta meta`
                  : `faltam ${formatar(meta.faltamCentavos)} para a meta`}
          </Txt>
        </View>

        <PilulasDeConta
          rotulo={retirar ? 'VOLTA PARA' : 'SAI DE'}
          contas={estado.contas}
          selecionada={estado.rascunho.contaId}
          aoEscolher={(contaId) => despachar({ tipo: 'RASCUNHO_CONTA', contaId })}
          nota={explicacao()}
        />

        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {ATALHOS.map((centavos) => (
            <PilulaValor key={centavos} centavos={centavos} />
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
          aoDigitar={(digito) => despachar({ tipo: 'DIGITO', valor: digito })}
          aoApagar={() => despachar({ tipo: 'APAGAR_DIGITO' })}
        />
        <BotaoPrincipal
          rotulo={
            valor === 0
              ? 'Informe um valor'
              : demais
                ? 'Mais do que está guardado'
                : retirar
                  ? `Retirar ${formatar(valor)}`
                  : `Adicionar ${formatar(valor)}`
          }
          fundo={podeConfirmar ? t.accent : t.lineInput}
          desabilitado={!podeConfirmar}
          aoTocar={() => despachar({ tipo: 'CONFIRMAR_MOVIMENTO_META' })}
        />
      </View>
    </Folha>
  );
}

function PilulaValor({ centavos }: { centavos: number }) {
  const { despachar } = useLoja();
  const { t } = useTema();
  return (
    <Toque
      aoTocar={() => despachar({ tipo: 'DEFINIR_DIGITOS', digitos: String(centavos) })}
      rotuloAcessivel={`Usar ${formatar(centavos)}`}
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
  );
}
