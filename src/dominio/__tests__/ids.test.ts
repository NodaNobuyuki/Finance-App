import { idsSequenciais, uuidV7 } from '../ids';

/**
 * Id de linha gravada não se troca sem migração de dado vivo. O que importa
 * aqui é o que a persistência e o sync vão depender: formato válido,
 * unicidade e ordenação por tempo.
 */

const FORMATO = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidV7', () => {
  it('tem formato de UUID, versão 7 e variante RFC', () => {
    for (let i = 0; i < 200; i++) expect(uuidV7()).toMatch(FORMATO);
  });

  it('não repete', () => {
    const vistos = new Set(Array.from({ length: 5000 }, () => uuidV7()));
    expect(vistos.size).toBe(5000);
  });

  it('ordena por tempo na ordem alfabética — é o ponto do v7 sobre o v4', () => {
    const antigo = uuidV7(1_000_000_000_000);
    const novo = uuidV7(1_700_000_000_000);
    expect(antigo < novo).toBe(true);
  });

  it('grava o instante recebido nos 48 bits altos', () => {
    const ms = 1_700_000_000_000;
    const hex = uuidV7(ms).replace(/-/g, '').slice(0, 12);
    expect(parseInt(hex, 16)).toBe(ms);
  });

  it('dois aparelhos no mesmo milissegundo não colidem', () => {
    const ms = 1_700_000_000_000;
    const lote = new Set(Array.from({ length: 2000 }, () => uuidV7(ms)));
    expect(lote.size).toBe(2000);
  });
});

describe('idsSequenciais', () => {
  it('é determinístico e reinicia a cada gerador', () => {
    expect([idsSequenciais('tx')(), idsSequenciais('tx')()]).toEqual(['tx-1', 'tx-1']);
  });

  it('não repete dentro do mesmo gerador', () => {
    const gerar = idsSequenciais();
    expect([gerar(), gerar(), gerar()]).toEqual(['id-1', 'id-2', 'id-3']);
  });
});
