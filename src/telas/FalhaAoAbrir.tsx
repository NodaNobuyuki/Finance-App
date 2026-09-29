import React from 'react';
import { View } from 'react-native';
import { Toque, Txt } from '../componentes/basicos';
import { Vazio } from '../componentes/Vazio';
import { icones } from '../dominio/categorias';
import { comAlfa } from '../tema/paletas';
import { useTema } from '../tema/TemaContext';

/**
 * O banco não abriu.
 *
 * Tela e não toast porque não há app por trás para mostrar: sem os dados, a
 * Home seria de outra pessoa — ou o onboarding de novo, que é pior ainda,
 * porque diz a quem já usa o app que tudo sumiu.
 *
 * Duas saídas, e a ordem importa. Tentar de novo é o caminho certo quase
 * sempre (banco travado, disco momentaneamente cheio). Usar sem salvar existe
 * para quem precisa do app agora — o simulador, uma conta rápida — e diz com
 * todas as letras o que custa.
 */
export function FalhaAoAbrir({
  aoTentar,
  aoUsarSemSalvar,
}: {
  aoTentar: () => void;
  aoUsarSemSalvar: () => void;
}) {
  const { t } = useTema();

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 16, gap: 8 }}>
      <Vazio
        icone={icones.desfazer}
        titulo="Não conseguimos abrir seus dados"
        texto="Nada foi apagado — eles continuam guardados no aparelho. Tente de novo; costuma resolver."
        acao={{ rotulo: 'Tentar de novo', aoTocar: aoTentar }}
      />
      <Toque
        aoTocar={aoUsarSemSalvar}
        rotuloAcessivel="Usar sem salvar"
        estilo={{ alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 16 }}
      >
        <View style={{ alignItems: 'center', gap: 3 }}>
          <Txt tamanho={13} peso={600} cor={t.inkSoft}>
            Usar sem salvar
          </Txt>
          <Txt tamanho={11.5} cor={t.inkFaint} alinhamento="center">
            O app abre vazio e nada desta sessão fica guardado.
          </Txt>
        </View>
      </Toque>
    </View>
  );
}

/**
 * Lembrete permanente do modo sem banco.
 *
 * Toast some em segundos; isto não pode sumir. Quem registra um gasto aqui e
 * não vê a faixa vai achar que ele foi salvo.
 */
export function FaixaSemSalvar() {
  const { t } = useTema();

  return (
    <View
      accessibilityRole="alert"
      style={{
        paddingVertical: 7,
        paddingHorizontal: 16,
        backgroundColor: comAlfa(t.atencao, 16),
        borderBottomWidth: 1,
        borderBottomColor: comAlfa(t.atencao, 30),
      }}
    >
      <Txt tamanho={11.5} peso={600} cor={t.ink} alinhamento="center">
        Sem salvar · o que você fizer agora some ao fechar o app
      </Txt>
    </View>
  );
}
