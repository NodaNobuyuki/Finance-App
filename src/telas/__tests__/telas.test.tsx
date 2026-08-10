import { render } from '@testing-library/react-native';
import React from 'react';
import { hojeReal, inicioDaSemana } from '../../dominio/datas';
import { Tela } from '../../dominio/tipos';
import {
  criarEstadoDemo,
  Estado,
  estadoInicial,
  estadoVazio,
  LojaProvider,
} from '../../estado/store';
import { PaletaId, paletas } from '../../tema/paletas';
import { TemaProvider } from '../../tema/TemaContext';
import { Categorias } from '../Categorias';
import { Extrato } from '../Extrato';
import { FecharSemana } from '../FecharSemana';
import { Habitos } from '../Habitos';
import { Inicio } from '../Inicio';
import { Lote } from '../Lote';
import { Metas } from '../Metas';
import { Onboarding } from '../Onboarding';
import { Resumo } from '../Resumo';
import { Simulador } from '../Simulador';
import { Aporte } from '../folhas/Aporte';
import { NovaTransacao } from '../folhas/NovaTransacao';
import { Ritual } from '../folhas/Ritual';

async function montar(no: React.ReactNode, estado: Estado = estadoInicial, paleta?: PaletaId) {
  return render(
    <TemaProvider inicial={paleta}>
      <LojaProvider inicial={estado}>{no}</LojaProvider>
    </TemaProvider>,
  );
}

const TELAS: {
  nome: Tela | string;
  no: React.ReactNode;
  texto: string;
  /** Âncora quando não há dado — a Home cumprimenta sem nome. */
  textoVazio?: string;
}[] = [
  { nome: 'home', no: <Inicio />, texto: 'Olá, Marina', textoVazio: 'Olá' },
  { nome: 'extrato', no: <Extrato />, texto: 'Extrato' },
  { nome: 'metas', no: <Metas />, texto: 'Metas' },
  { nome: 'categorias', no: <Categorias />, texto: 'Categorias' },
  { nome: 'habitos', no: <Habitos />, texto: 'Hábitos' },
  { nome: 'simulador', no: <Simulador />, texto: 'Vale a pena?' },
  { nome: 'lote', no: <Lote />, texto: 'Colocar em dia' },
  { nome: 'resumo', no: <Resumo />, texto: 'Resumo da semana' },
  { nome: 'fechar', no: <FecharSemana />, texto: 'Fechar a semana' },
  { nome: 'nova transação', no: <NovaTransacao />, texto: 'Nova transação' },
  { nome: 'aporte', no: <Aporte metaId="reserva" />, texto: 'Adicionar à meta' },
  { nome: 'ritual', no: <Ritual />, texto: 'Seu ritual' },
];

describe('renderização das telas', () => {
  it.each(TELAS)('$nome monta sem erro', async ({ no, texto }) => {
    const tela = await montar(no);
    expect(tela.getByText(texto)).toBeTruthy();
  });
});

describe('todas as paletas', () => {
  // Se alguma tela lê um token que a paleta não define, isto quebra.
  it.each(Object.keys(paletas) as PaletaId[])('%s renderiza a Home', async (id) => {
    const tela = await montar(<Inicio />, estadoInicial, id);
    expect(tela.getByText('Olá, Marina')).toBeTruthy();
  });
});

describe('relógio real', () => {
  // É este o caminho que o app roda de verdade desde que `AGORA` deixou de ser
  // o padrão. O resto da suíte usa a âncora fixa, então sem isto a data real
  // ficaria sem nenhuma cobertura — que é justamente onde mora o risco.
  it.each(TELAS)('$nome monta no dia de hoje', async ({ no, texto }) => {
    const tela = await montar(no, criarEstadoDemo(hojeReal()));
    expect(tela.getByText(texto)).toBeTruthy();
  });
});

describe('app vazio', () => {
  // Nunca tinham sido exercitadas: até a persistência entrar, sempre havia
  // seed. É aqui que aparece tela que só sabe existir com dado dentro.
  it.each(TELAS)('$nome monta sem dado nenhum', async ({ no, texto, textoVazio }) => {
    const tela = await montar(no, estadoVazio);
    expect(tela.getByText(textoVazio ?? texto)).toBeTruthy();
  });

  it('a Home cumprimenta sem nome, sem inventar um', async () => {
    const tela = await montar(<Inicio />, estadoVazio);
    expect(tela.getByText('Olá')).toBeTruthy();
    expect(tela.queryByText('Olá, Marina')).toBeNull();
  });

  it('a Home convida a registrar em vez de mostrar lista vazia', async () => {
    const tela = await montar(<Inicio />, estadoVazio);
    expect(tela.getByText('Nenhum lançamento ainda')).toBeTruthy();
  });

  it('o Extrato distingue "ainda não há nada" de "o filtro não casou"', async () => {
    const semNada = await montar(<Extrato />, estadoVazio);
    expect(semNada.getByText('Seu extrato começa aqui')).toBeTruthy();

    const comFiltro = await montar(<Extrato />, { ...estadoInicial, filtroCategoria: 'presente' });
    expect(comFiltro.getByText('Nenhuma transação com esses filtros')).toBeTruthy();
  });

  it('Metas vazio explica para que serve uma meta', async () => {
    const tela = await montar(<Metas />, estadoVazio);
    expect(tela.getByText('Nenhuma meta ainda')).toBeTruthy();
  });

  it('a Home não anuncia constância que não existe', async () => {
    const tela = await montar(<Inicio />, estadoVazio);
    expect(tela.queryByText(/semanas seguidas em dia/)).toBeNull();
  });

  it('o onboarding abre no passo 1', async () => {
    const tela = await montar(<Onboarding />, estadoVazio);
    expect(tela.getByText('Como podemos te chamar?')).toBeTruthy();
  });
});

describe('estados-limite', () => {
  it('Início funciona com a semana já fechada', async () => {
    const tela = await montar(<Inicio />, {
      ...estadoInicial,
      semanaFechada: inicioDaSemana(estadoInicial.hoje),
    });
    expect(tela.getByText('Semana fechada')).toBeTruthy();
  });

  it('Resumo aguenta uma semana sem nenhuma transação', async () => {
    const tela = await montar(<Resumo />, { ...estadoInicial, transacoes: [] });
    expect(tela.getByText('Resumo da semana')).toBeTruthy();
  });

  it('Lote aguenta não ter nenhum dia em aberto', async () => {
    const tela = await montar(<Lote />, {
      ...estadoInicial,
      diasSemGasto: ['2026-08-04', '2026-08-05'],
    });
    expect(tela.getByText('Colocar em dia')).toBeTruthy();
  });

  it('Fechar semana mostra o passo 3', async () => {
    const tela = await montar(<FecharSemana />, {
      ...estadoInicial,
      fecharPasso: 3,
      fechando: true,
    });
    expect(tela.getByText('Um foco para a próxima')).toBeTruthy();
  });
});
