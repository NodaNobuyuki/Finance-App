import { render } from '@testing-library/react-native';
import React from 'react';
import { Tela } from '../../dominio/tipos';
import { Estado, estadoInicial, LojaProvider } from '../../estado/store';
import { PaletaId, paletas } from '../../tema/paletas';
import { TemaProvider } from '../../tema/TemaContext';
import { Categorias } from '../Categorias';
import { Extrato } from '../Extrato';
import { FecharSemana } from '../FecharSemana';
import { Habitos } from '../Habitos';
import { Inicio } from '../Inicio';
import { Lote } from '../Lote';
import { Metas } from '../Metas';
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

const TELAS: { nome: Tela | string; no: React.ReactNode; texto: string }[] = [
  { nome: 'home', no: <Inicio />, texto: 'Olá, Marina' },
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

describe('estados-limite', () => {
  it('Início funciona com a semana já fechada', async () => {
    const tela = await montar(<Inicio />, { ...estadoInicial, semanaFechada: true });
    expect(tela.getByText('Semana fechada')).toBeTruthy();
  });

  it('Extrato mostra vazio quando o filtro não casa com nada', async () => {
    const tela = await montar(<Extrato />, { ...estadoInicial, filtroCategoria: 'presente' });
    expect(tela.getByText('Nenhuma transação com esses filtros.')).toBeTruthy();
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
    const tela = await montar(<FecharSemana />, { ...estadoInicial, fecharPasso: 3, fechando: true });
    expect(tela.getByText('Um foco para a próxima')).toBeTruthy();
  });
});
