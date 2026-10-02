// Importados por subpath de propósito: o barril do pacote arrasta todos os
// pesos e itálicos (~4 MB de TTF) para dentro do APK.
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans/700Bold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { NavInferior } from './componentes/NavInferior';
import { Toast } from './componentes/Toast';
import { Transicao } from './componentes/Transicao';
import { useBanco } from './dados/boot';
import { RepositorioLocal } from './dados/repositorio';
import { usePersistencia } from './dados/usePersistencia';
import { mensagemParaOUsuario } from './dominio/erros';
import { Tela } from './dominio/tipos';
import { LojaProvider, useDespachar, useSeletor, useSincronizarDia } from './estado/store';
import { Categorias } from './telas/Categorias';
import { Extrato } from './telas/Extrato';
import { FaixaSemSalvar, FalhaAoAbrir } from './telas/FalhaAoAbrir';
import { FecharSemana } from './telas/FecharSemana';
import { Habitos } from './telas/Habitos';
import { Inicio } from './telas/Inicio';
import { Lote } from './telas/Lote';
import { Metas } from './telas/Metas';
import { Onboarding } from './telas/Onboarding';
import { Resumo } from './telas/Resumo';
import { Simulador } from './telas/Simulador';
import { CadastroCategoria } from './telas/folhas/CadastroCategoria';
import { CadastroConta } from './telas/folhas/CadastroConta';
import { CadastroMeta } from './telas/folhas/CadastroMeta';
import { DetalheTransferencia } from './telas/folhas/DetalheTransferencia';
import { MovimentoMeta } from './telas/folhas/MovimentoMeta';
import { NovaTransacao } from './telas/folhas/NovaTransacao';
import { Ritual } from './telas/folhas/Ritual';
import { Transferencia } from './telas/folhas/Transferencia';
import { TemaProvider, useTema } from './tema/TemaContext';

/**
 * Telas que trazem a própria rolagem e por isso ficam fora do `ScrollView` da
 * `Casca`. Lista virtualizada dentro de outra rolagem vertical renderiza tudo
 * de uma vez — o RN avisa, e a virtualização some.
 */
const TELAS_COM_ROLAGEM_PROPRIA: ReadonlySet<Tela> = new Set<Tela>(['extrato']);

function TelaAtual() {
  const tela = useSeletor((e) => e.tela);
  switch (tela) {
    case 'extrato':
      return <Extrato />;
    case 'metas':
      return <Metas />;
    case 'categorias':
      return <Categorias />;
    case 'habitos':
      return <Habitos />;
    case 'simulador':
      return <Simulador />;
    case 'lote':
      return <Lote />;
    case 'resumo':
      return <Resumo />;
    case 'fechar':
      return <FecharSemana />;
    case 'home':
    default:
      return <Inicio />;
  }
}

function FolhaAtual() {
  const folha = useSeletor((e) => e.folha);
  if (!folha) return null;
  switch (folha.tipo) {
    case 'nova':
      return <NovaTransacao />;
    case 'movimentoMeta':
      return <MovimentoMeta metaId={folha.metaId} retirar={folha.retirar} />;
    case 'transferencia':
      return <Transferencia />;
    case 'ritual':
      return <Ritual />;
    case 'conta':
      return <CadastroConta />;
    case 'meta':
      return <CadastroMeta />;
    case 'categoria':
      return <CadastroCategoria />;
    case 'detalheTransferencia':
      return <DetalheTransferencia transferenciaId={folha.transferenciaId} />;
    default:
      return null;
  }
}

function Casca({ repositorio, semDisco }: { repositorio: RepositorioLocal; semDisco: boolean }) {
  const tela = useSeletor((e) => e.tela);
  const onboardingConcluido = useSeletor((e) => e.onboardingConcluido);
  const despachar = useDespachar();
  const { t, paleta } = useTema();

  useSincronizarDia();
  usePersistencia(repositorio, (erro) => {
    // Falha de disco não pode ser silenciosa: o usuário achou que registrou.
    despachar({ tipo: 'AVISAR', texto: mensagemParaOUsuario(erro) });
  });

  // Primeiro uso ocupa a tela inteira: sem nav, sem folha, sem saída lateral.
  // Enquanto não há uma conta, não existe nada que as outras telas possam mostrar.
  if (!onboardingConcluido) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.canvas }}>
        <StatusBar style={paleta.escuro ? 'light' : 'dark'} />
        {semDisco ? <FaixaSemSalvar /> : null}
        <Onboarding />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.canvas }}>
      <StatusBar style={paleta.escuro ? 'light' : 'dark'} />
      {semDisco ? <FaixaSemSalvar /> : null}
      <View style={{ flex: 1, backgroundColor: t.canvas }}>
        {TELAS_COM_ROLAGEM_PROPRIA.has(tela) ? (
          // Sem ScrollView em volta, a remontagem pela troca de componente já
          // devolve a lista ao topo.
          <View style={{ flex: 1 }}>
            <Transicao chave={tela}>
              <TelaAtual />
            </Transicao>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            // Rola até o topo quando a tela muda, senão o usuário cai no meio
            // do conteúdo anterior.
            key={tela}
          >
            <Transicao chave={tela}>
              <TelaAtual />
            </Transicao>
          </ScrollView>
        )}

        <NavInferior />
        <Toast />
        <FolhaAtual />
      </View>
    </SafeAreaView>
  );
}

/** A tela de falha fica fora da `Casca`: não há loja, porque não há dados. */
function FundoDaFalha({ children }: { children: React.ReactNode }) {
  const { t, paleta } = useTema();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.canvas }}>
      <StatusBar style={paleta.escuro ? 'light' : 'dark'} />
      {children}
    </SafeAreaView>
  );
}

export default function App() {
  const [fontesProntas] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  const { boot, tentarDeNovo, usarSemSalvar } = useBanco();

  // Fontes e banco carregam em paralelo; a splash do Expo cobre os dois.
  if (!fontesProntas || !boot) return null;

  if (boot.tipo === 'falhou') {
    return (
      <TemaProvider>
        <FundoDaFalha>
          <FalhaAoAbrir aoTentar={tentarDeNovo} aoUsarSemSalvar={usarSemSalvar} />
        </FundoDaFalha>
      </TemaProvider>
    );
  }

  return (
    <TemaProvider>
      <LojaProvider inicial={boot.inicial}>
        <Casca repositorio={boot.repositorio} semDisco={boot.semDisco} />
      </LojaProvider>
    </TemaProvider>
  );
}
