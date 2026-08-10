import React from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { BotaoPrincipal, Hero, Rotulo, Toque, Txt } from '../componentes/basicos';
import { Teclado } from '../componentes/Teclado';
import { deDigitos, empilharDigitos, formatar, removerDigito } from '../dominio/dinheiro';
import { Conta } from '../dominio/tipos';
import { useLoja } from '../estado/store';
import { sans } from '../tema/fontes';
import { useTema } from '../tema/TemaContext';
import { Passos } from './Resumo';

/**
 * Primeiro uso, em 3 passos: nome → primeira conta → primeira meta.
 *
 * Curto de propósito. Cada campo a mais aqui é gente que desiste antes de
 * registrar o primeiro gasto — que é o momento em que o app prova o que faz.
 * Só o nome é obrigatório; conta abre em zero e meta pode ficar para depois.
 */

const TIPOS: { id: Conta['tipo']; nome: string }[] = [
  { id: 'corrente', nome: 'Conta corrente' },
  { id: 'carteira', nome: 'Carteira' },
  { id: 'cartao', nome: 'Cartão' },
  { id: 'poupanca', nome: 'Poupança' },
];

export function Onboarding() {
  const { estado, despachar } = useLoja();
  const { t } = useTema();

  const o = estado.onboarding;
  const podeAvancar = o.passo === 1 ? o.nome.trim().length > 0 : true;

  const entrada = (
    valor: string,
    aoMudar: (texto: string) => void,
    placeholder: string,
    autoFoco = false,
  ) => (
    <TextInput
      value={valor}
      onChangeText={aoMudar}
      placeholder={placeholder}
      placeholderTextColor={t.inkFaint}
      autoFocus={autoFoco}
      style={[
        sans(500),
        {
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.lineInput,
          borderRadius: 12,
          paddingVertical: 13,
          paddingHorizontal: 14,
          fontSize: 15,
          color: t.ink,
        },
      ]}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas }}>
      <Hero>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Passos atual={o.passo} />
        </View>
        <View style={{ gap: 8, marginTop: 18 }}>
          <Rotulo cor={t.onHeroSoft}>Passo {o.passo} de 3</Rotulo>
          <Txt tamanho={26} peso={600} cor={t.onHero} espacamento={-0.78} entrelinha={1.15}>
            {o.passo === 1
              ? 'Como podemos te chamar?'
              : o.passo === 2
                ? 'Onde está seu dinheiro?'
                : 'O que você quer conquistar?'}
          </Txt>
          <Txt tamanho={12.5} cor={t.onHeroSoft} entrelinha={1.5}>
            {o.passo === 1
              ? 'O app é seu e fica só no seu aparelho. Nada é enviado para lugar nenhum.'
              : o.passo === 2
                ? 'Uma conta basta para começar. Dá para somar outras depois.'
                : 'Uma meta transforma gasto evitado em algo concreto. Pode pular e criar depois.'}
          </Txt>
        </View>
      </Hero>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 22, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {o.passo === 1 ? (
          <View style={{ gap: 9 }}>
            <Rotulo>Seu nome</Rotulo>
            {entrada(
              o.nome,
              (valor) => despachar({ tipo: 'ONBOARDING_CAMPO', campo: 'nome', valor }),
              'Como seus amigos te chamam',
              true,
            )}
          </View>
        ) : null}

        {o.passo === 2 ? (
          <>
            <View style={{ gap: 9 }}>
              <Rotulo>Tipo</Rotulo>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {TIPOS.map((tipo) => {
                  const ativo = o.contaTipo === tipo.id;
                  return (
                    <Toque
                      key={tipo.id}
                      aoTocar={() => {
                        despachar({ tipo: 'ONBOARDING_TIPO_CONTA', tipo_: tipo.id });
                        despachar({
                          tipo: 'ONBOARDING_CAMPO',
                          campo: 'contaNome',
                          valor: tipo.nome,
                        });
                      }}
                      rotuloAcessivel={tipo.nome}
                    >
                      <View
                        style={{
                          borderRadius: 999,
                          paddingVertical: 9,
                          paddingHorizontal: 15,
                          borderWidth: 1,
                          borderColor: ativo ? t.accent : t.lineInput,
                          backgroundColor: ativo ? t.accent : t.surface,
                        }}
                      >
                        <Txt tamanho={12.5} peso={600} cor={ativo ? t.onAccent : t.inkMuted}>
                          {tipo.nome}
                        </Txt>
                      </View>
                    </Toque>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: 9 }}>
              <Rotulo>Nome da conta</Rotulo>
              {entrada(
                o.contaNome,
                (valor) => despachar({ tipo: 'ONBOARDING_CAMPO', campo: 'contaNome', valor }),
                'Ex.: Nubank',
              )}
            </View>

            <View style={{ gap: 6, alignItems: 'center' }}>
              <Rotulo>Saldo de hoje</Rotulo>
              <Txt tamanho={38} peso={600} numerico espacamento={-1.14} entrelinha={1.1}>
                {formatar(deDigitos(o.contaDigitos))}
              </Txt>
              <Txt tamanho={11.5} cor={t.inkFaint} alinhamento="center" entrelinha={1.45}>
                Pode deixar zerado. O saldo é sempre calculado a partir daqui.
              </Txt>
            </View>

            <Teclado
              altura={46}
              aoDigitar={(digito) =>
                despachar({
                  tipo: 'ONBOARDING_CAMPO',
                  campo: 'contaDigitos',
                  valor: empilharDigitos(o.contaDigitos, digito),
                })
              }
              aoApagar={() =>
                despachar({
                  tipo: 'ONBOARDING_CAMPO',
                  campo: 'contaDigitos',
                  valor: removerDigito(o.contaDigitos),
                })
              }
            />
          </>
        ) : null}

        {o.passo === 3 ? (
          <>
            <View style={{ gap: 9 }}>
              <Rotulo>Nome da meta</Rotulo>
              {entrada(
                o.metaNome,
                (valor) => despachar({ tipo: 'ONBOARDING_CAMPO', campo: 'metaNome', valor }),
                'Ex.: Reserva de emergência',
              )}
            </View>

            <View style={{ gap: 6, alignItems: 'center' }}>
              <Rotulo>Quanto quer juntar</Rotulo>
              <Txt tamanho={38} peso={600} numerico espacamento={-1.14} entrelinha={1.1}>
                {formatar(deDigitos(o.metaDigitos))}
              </Txt>
            </View>

            <Teclado
              altura={46}
              aoDigitar={(digito) =>
                despachar({
                  tipo: 'ONBOARDING_CAMPO',
                  campo: 'metaDigitos',
                  valor: empilharDigitos(o.metaDigitos, digito),
                })
              }
              aoApagar={() =>
                despachar({
                  tipo: 'ONBOARDING_CAMPO',
                  campo: 'metaDigitos',
                  valor: removerDigito(o.metaDigitos),
                })
              }
            />
          </>
        ) : null}
      </ScrollView>

      <View
        style={{
          backgroundColor: t.surface,
          borderTopWidth: 1,
          borderTopColor: t.line,
          padding: 16,
          gap: 12,
        }}
      >
        <BotaoPrincipal
          rotulo={o.passo === 3 ? 'Começar' : 'Continuar'}
          desabilitado={!podeAvancar}
          aoTocar={() =>
            o.passo === 3
              ? despachar({ tipo: 'ONBOARDING_CONCLUIR' })
              : despachar({ tipo: 'ONBOARDING_PASSO', passo: o.passo === 1 ? 2 : 3 })
          }
        />

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 }}>
          {o.passo > 1 ? (
            <Toque
              aoTocar={() => despachar({ tipo: 'ONBOARDING_PASSO', passo: o.passo === 3 ? 2 : 1 })}
              rotuloAcessivel="Voltar um passo"
            >
              <Txt tamanho={12.5} peso={600} cor={t.inkMuted}>
                Voltar
              </Txt>
            </Toque>
          ) : null}

          {/* Escape para quem só quer ver o app funcionando antes de investir
              tempo digitando o próprio dinheiro. */}
          <Toque
            aoTocar={() => despachar({ tipo: 'CARREGAR_DEMO' })}
            rotuloAcessivel="Ver com dados de exemplo"
          >
            <Txt tamanho={12.5} peso={600} cor={t.accent}>
              Ver com dados de exemplo
            </Txt>
          </Toque>
        </View>
      </View>
    </View>
  );
}
