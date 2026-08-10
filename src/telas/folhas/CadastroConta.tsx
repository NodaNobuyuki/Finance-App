import React from 'react';
import { ScrollView, View } from 'react-native';
import { BotaoPrincipal, Txt } from '../../componentes/basicos';
import { Teclado } from '../../componentes/Teclado';
import { deDigitos, empilharDigitos, formatar, removerDigito } from '../../dominio/dinheiro';
import { saldoDaConta } from '../../dominio/saldo';
import { Conta } from '../../dominio/tipos';
import { useLoja } from '../../estado/store';
import { useTema } from '../../tema/TemaContext';
import { BotaoApagar, CampoTexto, Opcoes } from './Campo';
import { Folha } from './Folha';

const TIPOS: { id: Conta['tipo']; nome: string }[] = [
  { id: 'corrente', nome: 'Conta corrente' },
  { id: 'carteira', nome: 'Carteira' },
  { id: 'cartao', nome: 'Cartão' },
  { id: 'poupanca', nome: 'Poupança' },
];

/**
 * Criar e editar conta com o app já rodando.
 *
 * Antes só o onboarding criava conta, então quem apagasse tudo — ou só quisesse
 * uma segunda — ficava sem caminho.
 */
export function CadastroConta() {
  const { estado, despachar } = useLoja();
  const { t } = useTema();

  const c = estado.cadastroConta;
  const editando = c.id !== null;
  const magnitude = deDigitos(c.digitos);
  const cartao = c.tipo === 'cartao';
  const podeSalvar = c.nome.trim().length > 0;

  const original = editando ? estado.contas.find((x) => x.id === c.id) : undefined;
  const saldoAtual = original ? saldoDaConta(original, estado.transacoes) : 0;

  return (
    <Folha
      titulo={editando ? 'Editar conta' : 'Nova conta'}
      aoFechar={() => despachar({ tipo: 'FECHAR_FOLHA' })}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 22, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <Opcoes
          rotulo="Tipo"
          opcoes={TIPOS}
          selecionada={c.tipo}
          aoEscolher={(tipo_) => {
            despachar({ tipo: 'CADASTRO_CONTA_TIPO', tipo_ });
            // Nome ainda em branco recebe o do tipo: quem só quer "Carteira"
            // não precisa digitar "Carteira".
            if (!c.nome.trim()) {
              const nome = TIPOS.find((x) => x.id === tipo_)!.nome;
              despachar({ tipo: 'CADASTRO_CONTA_CAMPO', campo: 'nome', valor: nome });
            }
          }}
        />

        <CampoTexto
          rotulo="Nome da conta"
          valor={c.nome}
          aoMudar={(valor) => despachar({ tipo: 'CADASTRO_CONTA_CAMPO', campo: 'nome', valor })}
          placeholder="Ex.: Nubank"
          autoFoco={!editando}
        />

        <View style={{ gap: 6, alignItems: 'center' }}>
          <Txt tamanho={11} peso={600} cor={t.inkMuted} espacamento={0.5}>
            {cartao ? 'QUANTO JÁ DEVE' : 'SALDO DE ABERTURA'}
          </Txt>
          <Txt
            tamanho={38}
            peso={600}
            numerico
            espacamento={-1.14}
            entrelinha={1.1}
            cor={cartao && magnitude > 0 ? t.down : t.ink}
          >
            {cartao && magnitude > 0 ? `− ${formatar(magnitude)}` : formatar(magnitude)}
          </Txt>
          <Txt tamanho={11.5} cor={t.inkFaint} alinhamento="center" entrelinha={1.45}>
            {cartao
              ? 'Fatura em aberto entra como dívida. O sinal vem do tipo da conta.'
              : 'Abertura, não saldo de hoje: os lançamentos são somados por cima.'}
          </Txt>

          {editando ? (
            <Txt tamanho={11.5} cor={t.inkSoft} alinhamento="center" entrelinha={1.45}>
              Saldo atual desta conta: {formatar(saldoAtual)}
            </Txt>
          ) : null}
        </View>

        <Teclado
          altura={46}
          aoDigitar={(digito) =>
            despachar({
              tipo: 'CADASTRO_CONTA_CAMPO',
              campo: 'digitos',
              valor: empilharDigitos(c.digitos, digito),
            })
          }
          aoApagar={() =>
            despachar({
              tipo: 'CADASTRO_CONTA_CAMPO',
              campo: 'digitos',
              valor: removerDigito(c.digitos),
            })
          }
        />

        {editando ? (
          <BotaoApagar
            rotulo="Apagar conta"
            aoTocar={() => despachar({ tipo: 'APAGAR_CONTA', contaId: c.id! })}
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
          rotulo={editando ? 'Salvar' : 'Criar conta'}
          desabilitado={!podeSalvar}
          fundo={podeSalvar ? t.accent : t.lineInput}
          aoTocar={() => despachar({ tipo: 'SALVAR_CONTA' })}
        />
      </View>
    </Folha>
  );
}
