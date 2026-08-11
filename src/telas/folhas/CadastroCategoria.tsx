import React from 'react';
import { ScrollView, View } from 'react-native';
import { BotaoPrincipal, Rotulo, Toque, Txt } from '../../componentes/basicos';
import { Icone } from '../../componentes/Icone';
import { coresDeCategoria, iconesDeCategoria } from '../../dominio/categorias';
import { useLoja } from '../../estado/store';
import { comAlfa, CorRef, resolverCor } from '../../tema/paletas';
import { useTema } from '../../tema/TemaContext';
import { BotaoApagar, CampoTexto, Opcoes } from './Campo';
import { Folha } from './Folha';

const TIPOS: { id: 'despesa' | 'receita'; nome: string }[] = [
  { id: 'despesa', nome: 'Despesa' },
  { id: 'receita', nome: 'Receita' },
];

/**
 * Criar e editar categoria.
 *
 * Enquanto categoria era catálogo de módulo, "Nova categoria" era um retângulo
 * tracejado que não fazia nada — não havia onde gravar.
 */
export function CadastroCategoria() {
  const { estado, despachar } = useLoja();
  const { t, paleta } = useTema();

  const c = estado.cadastroCategoria;
  const editando = c.id !== null;
  const podeSalvar = c.nome.trim().length > 0;
  const cor = resolverCor(c.cor, paleta);

  const usos = editando
    ? estado.transacoes.filter((tx) => tx.categoriaId === c.id).length
    : 0;

  return (
    <Folha
      titulo={editando ? 'Editar categoria' : 'Nova categoria'}
      aoFechar={() => despachar({ tipo: 'FECHAR_FOLHA' })}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 22, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: cor,
            }}
          >
            <Icone path={c.icone} tamanho={28} cor={t.onAccent} espessura={1.7} />
          </View>
          <Txt tamanho={13} peso={600} cor={t.inkMuted}>
            {c.nome.trim() || 'Sua categoria'}
          </Txt>
        </View>

        <CampoTexto
          rotulo="Nome"
          valor={c.nome}
          aoMudar={(valor) => despachar({ tipo: 'CADASTRO_CATEGORIA_NOME', valor })}
          placeholder="Ex.: Pet"
          autoFoco={!editando}
        />

        <Opcoes
          rotulo="Tipo"
          opcoes={TIPOS}
          selecionada={c.tipo}
          aoEscolher={(tipo_) => despachar({ tipo: 'CADASTRO_CATEGORIA_TIPO', tipo_ })}
        />

        <View style={{ gap: 9 }}>
          <Rotulo>Cor</Rotulo>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {coresDeCategoria.map((opcao, i) => (
              <Pastilha
                key={i}
                cor={opcao}
                ativa={resolverCor(opcao, paleta) === cor}
                aoTocar={() => despachar({ tipo: 'CADASTRO_CATEGORIA_COR', cor: opcao })}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: 9 }}>
          <Rotulo>Ícone</Rotulo>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {iconesDeCategoria.map((icone) => {
              const ativo = icone === c.icone;
              return (
                <Toque
                  key={icone}
                  aoTocar={() => despachar({ tipo: 'CADASTRO_CATEGORIA_ICONE', icone })}
                  rotuloAcessivel="Escolher ícone"
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: ativo ? cor : t.lineInput,
                      backgroundColor: ativo ? comAlfa(cor, 12) : t.surface,
                    }}
                  >
                    <Icone path={icone} tamanho={20} cor={ativo ? cor : t.inkMuted} />
                  </View>
                </Toque>
              );
            })}
          </View>
        </View>

        {editando ? (
          <View style={{ gap: 8 }}>
            <BotaoApagar
              rotulo="Apagar categoria"
              aoTocar={() => despachar({ tipo: 'APAGAR_CATEGORIA', categoriaId: c.id! })}
            />
            {usos > 0 ? (
              // Ao contrário de apagar conta, os lançamentos FICAM: o gasto
              // aconteceu e o dinheiro saiu, independentemente do rótulo.
              <Txt tamanho={11.5} cor={t.inkFaint} alinhamento="center" entrelinha={1.45}>
                {usos} {usos === 1 ? 'lançamento usa' : 'lançamentos usam'} esta categoria. Eles
                ficam, como &ldquo;Sem categoria&rdquo;, e dá para recategorizar no Extrato.
              </Txt>
            ) : null}
          </View>
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
          rotulo={editando ? 'Salvar' : 'Criar categoria'}
          desabilitado={!podeSalvar}
          fundo={podeSalvar ? t.accent : t.lineInput}
          aoTocar={() => despachar({ tipo: 'SALVAR_CATEGORIA' })}
        />
      </View>
    </Folha>
  );
}

function Pastilha({
  cor,
  ativa,
  aoTocar,
}: {
  cor: CorRef;
  ativa: boolean;
  aoTocar: () => void;
}) {
  const { t, paleta } = useTema();
  const resolvida = resolverCor(cor, paleta);
  return (
    <Toque aoTocar={aoTocar} rotuloAcessivel="Escolher cor">
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          backgroundColor: resolvida,
          borderWidth: ativa ? 3 : 0,
          borderColor: t.ink,
        }}
      />
    </Toque>
  );
}
