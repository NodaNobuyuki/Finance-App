import { diferencaDeChaves, diferencaPorId, vazia } from '../diff';

type Item = { id: string; v: number };

const item = (id: string, v = 0): Item => ({ id, v });

describe('diferencaPorId', () => {
  it('sem mudança, não há nada a gravar', () => {
    const lista = [item('a'), item('b')];
    const d = diferencaPorId(lista, lista);
    expect(vazia(d)).toBe(true);
  });

  it('objeto intacto não conta como atualização', () => {
    // O reducer copia só o que muda, então quem sobreviveu é o mesmo objeto.
    // É isto que faz registrar um gasto gravar UMA linha, não a tabela toda.
    const a = item('a');
    const b = item('b');
    const d = diferencaPorId([a, b], [a, b, item('c')]);

    expect(d.inserir.map((i) => i.id)).toEqual(['c']);
    expect(d.atualizar).toEqual([]);
    expect(d.remover).toEqual([]);
  });

  it('objeto recriado com o mesmo conteúdo conta como atualização', () => {
    // Conservador de propósito: gravar de novo é barato, deixar de gravar
    // uma mudança real é perda de dado.
    const d = diferencaPorId([item('a', 1)], [item('a', 1)]);
    expect(d.atualizar.map((i) => i.id)).toEqual(['a']);
  });

  it('detecta remoção', () => {
    const d = diferencaPorId([item('a'), item('b')], [item('a')]);
    expect(d.remover).toEqual(['b']);
  });

  it('lida com inserir, atualizar e remover de uma vez', () => {
    const a = item('a');
    const d = diferencaPorId([a, item('b', 1), item('c')], [a, item('b', 2), item('d')]);

    expect(d.inserir.map((i) => i.id)).toEqual(['d']);
    expect(d.atualizar.map((i) => i.id)).toEqual(['b']);
    expect(d.remover).toEqual(['c']);
  });

  it('partindo do vazio, tudo é inserção', () => {
    const d = diferencaPorId([], [item('a'), item('b')]);
    expect(d.inserir).toHaveLength(2);
    expect(d.remover).toEqual([]);
  });

  it('esvaziar remove tudo', () => {
    const d = diferencaPorId([item('a'), item('b')], []);
    expect(d.remover).toEqual(['a', 'b']);
    expect(d.inserir).toEqual([]);
  });

  it('reordenar sem alterar nada não gera escrita', () => {
    const a = item('a');
    const b = item('b');
    expect(vazia(diferencaPorId([a, b], [b, a]))).toBe(true);
  });
});

describe('diferencaDeChaves', () => {
  it('acha entradas e saídas', () => {
    const d = diferencaDeChaves(['2026-08-04', '2026-08-05'], ['2026-08-05', '2026-08-06']);
    expect(d.inserir).toEqual(['2026-08-06']);
    expect(d.remover).toEqual(['2026-08-04']);
  });

  it('listas iguais não geram nada', () => {
    const d = diferencaDeChaves(['a'], ['a']);
    expect(d.inserir).toEqual([]);
    expect(d.remover).toEqual([]);
  });
});
