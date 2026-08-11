import React from 'react';
import { ScrollView, View } from 'react-native';
import { BotaoPrincipal, Txt } from '../../componentes/basicos';
import { Teclado } from '../../componentes/Teclado';
import { somarDias } from '../../dominio/datas';
import { deDigitos, empilharDigitos, formatar, removerDigito } from '../../dominio/dinheiro';
import { rotuloDePrazo } from '../../dominio/metas';
import { useLoja } from '../../estado/store';
import { useTema } from '../../tema/TemaContext';
import { BotaoApagar, CampoTexto, Opcoes } from './Campo';
import { Folha } from './Folha';

/**
 * Prazos em dias a partir de hoje.
 *
 * Atalhos em vez de calendário: a pergunta que a pessoa se faz é "em quanto
 * tempo", não "em que dia". Um seletor de data seria dependência nativa nova
 * para responder pior a mesma coisa — e a data exata continua editável pelo
 * dia em que o prazo cair.
 */
const PRAZOS: { id: string; nome: string; dias: number | null }[] = [
  { id: 'nenhum', nome: 'Sem prazo', dias: null },
  { id: '90', nome: '3 meses', dias: 90 },
  { id: '180', nome: '6 meses', dias: 180 },
  { id: '365', nome: '1 ano', dias: 365 },
  { id: '730', nome: '2 anos', dias: 730 },
];

export function CadastroMeta() {
  const { estado, despachar } = useLoja();
  const { t } = useTema();

  const c = estado.cadastroMeta;
  const editando = c.id !== null;
  const alvo = deDigitos(c.digitos);
  const podeSalvar = c.nome.trim().length > 0 && alvo > 0;

  // Meta editada pode ter prazo que não bate com atalho nenhum — aí nenhuma
  // pílula fica ativa e o texto abaixo mostra a data que vale.
  const selecionado =
    PRAZOS.find((p) =>
      p.dias === null ? c.prazo === null : c.prazo === somarDias(estado.hoje, p.dias),
    )?.id ?? '';

  return (
    <Folha
      titulo={editando ? 'Editar meta' : 'Nova meta'}
      aoFechar={() => despachar({ tipo: 'FECHAR_FOLHA' })}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 22, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <CampoTexto
          rotulo="Nome da meta"
          valor={c.nome}
          aoMudar={(valor) => despachar({ tipo: 'CADASTRO_META_CAMPO', campo: 'nome', valor })}
          placeholder="Ex.: Reserva de emergência"
          autoFoco={!editando}
        />

        <View style={{ gap: 6, alignItems: 'center' }}>
          <Txt tamanho={11} peso={600} cor={t.inkMuted} espacamento={0.5}>
            QUANTO QUER JUNTAR
          </Txt>
          <Txt
            tamanho={38}
            peso={600}
            numerico
            espacamento={-1.14}
            entrelinha={1.1}
            cor={alvo === 0 ? t.inkFaint : t.ink}
          >
            {formatar(alvo)}
          </Txt>
        </View>

        <Teclado
          altura={46}
          aoDigitar={(digito) =>
            despachar({
              tipo: 'CADASTRO_META_CAMPO',
              campo: 'digitos',
              valor: empilharDigitos(c.digitos, digito),
            })
          }
          aoApagar={() =>
            despachar({
              tipo: 'CADASTRO_META_CAMPO',
              campo: 'digitos',
              valor: removerDigito(c.digitos),
            })
          }
        />

        {/* Onde o dinheiro guardado fica de verdade: a entrada da transferência
            precisa cair em alguma conta, senão guardar criaria dinheiro do nada. */}
        <Opcoes
          rotulo="Guardar em"
          opcoes={estado.contas.map((c) => ({ id: c.id, nome: c.nome }))}
          selecionada={c.contaId}
          aoEscolher={(contaId) => despachar({ tipo: 'CADASTRO_META_CONTA', contaId })}
        />

        <View style={{ gap: 9 }}>
          <Opcoes
            rotulo="Prazo"
            opcoes={PRAZOS.map(({ id, nome }) => ({ id, nome }))}
            selecionada={selecionado}
            aoEscolher={(id) => {
              const escolhido = PRAZOS.find((p) => p.id === id)!;
              despachar({
                tipo: 'CADASTRO_META_PRAZO',
                prazo: escolhido.dias === null ? null : somarDias(estado.hoje, escolhido.dias),
              });
            }}
          />
          <Txt tamanho={11.5} cor={t.inkFaint} entrelinha={1.45}>
            {rotuloDePrazo(c.prazo, estado.hoje)}
          </Txt>
        </View>

        {editando ? (
          <BotaoApagar
            rotulo="Apagar meta"
            aoTocar={() => despachar({ tipo: 'APAGAR_META', metaId: c.id! })}
          />
        ) : null}
      </ScrollView>

      <View
        style={{
          backgroundColor: t.surface,
          borderTopWidth: 1,
          borderTopColor: t.line,
          padding: 16,
        }}
      >
        <BotaoPrincipal
          rotulo={editando ? 'Salvar' : 'Criar meta'}
          desabilitado={!podeSalvar}
          fundo={podeSalvar ? t.accent : t.lineInput}
          aoTocar={() => despachar({ tipo: 'SALVAR_META' })}
        />
      </View>
    </Folha>
  );
}
