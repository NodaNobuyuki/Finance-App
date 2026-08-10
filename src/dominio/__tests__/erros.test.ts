import { categoria, categoriaExiste, categorias } from '../categorias';
import {
  BancoIndisponivel,
  ErroDeDominio,
  ErroDeInfra,
  ErroDoApp,
  EscritaFalhou,
  mensagemParaOUsuario,
  MetaDesconhecida,
  MigracaoFalhou,
} from '../erros';

describe('taxonomia', () => {
  it('domínio e infra são distinguíveis por instanceof', () => {
    const dominio = new MetaDesconhecida('reserva');
    const infra = new BancoIndisponivel();

    expect(dominio).toBeInstanceOf(ErroDeDominio);
    expect(dominio).not.toBeInstanceOf(ErroDeInfra);
    expect(infra).toBeInstanceOf(ErroDeInfra);
    expect(infra).not.toBeInstanceOf(ErroDeDominio);
  });

  it('sobrevive ao transpile — `instanceof Error` continua valendo', () => {
    // É a armadilha clássica de `class X extends Error` sob Babel: sem
    // `setPrototypeOf`, todo catch tipado passa reto e o erro vira genérico.
    const erro = new MetaDesconhecida('chile');
    expect(erro).toBeInstanceOf(Error);
    expect(erro).toBeInstanceOf(ErroDoApp);
    expect(erro.name).toBe('MetaDesconhecida');
    expect(erro.stack).toBeTruthy();
  });

  it('carrega código estável e dado estruturado, não só texto', () => {
    const erro = new MigracaoFalhou(3, 'adiciona-orcamentos');
    expect(erro.codigo).toBe('migracao-falhou');
    expect(erro.versao).toBe(3);
    expect(erro.nomeDaMigracao).toBe('adiciona-orcamentos');
  });

  it('preserva a causa original ao embrulhar', () => {
    const raiz = new Error('SQLITE_FULL: database or disk is full');
    expect(new EscritaFalhou('transações', raiz).causa).toBe(raiz);
  });
});

describe('mensagemParaOUsuario', () => {
  it('mostra o erro de domínio, que é explicável', () => {
    expect(mensagemParaOUsuario(new MetaDesconhecida('reserva'))).toContain('reserva');
  });

  it('não vaza detalhe técnico de infra', () => {
    const texto = mensagemParaOUsuario(new EscritaFalhou('transações', new Error('SQLITE_FULL')));
    expect(texto).not.toMatch(/SQLITE|transações/);
    expect(texto).toBe('Não deu para salvar agora. Vamos tentar de novo.');
  });

  it('aguenta o que não é erro nosso', () => {
    expect(mensagemParaOUsuario('string solta')).toBe('Algo deu errado.');
    expect(mensagemParaOUsuario(undefined)).toBe('Algo deu errado.');
  });
});

describe('categoria órfã', () => {
  it('não lança para id fora do catálogo', () => {
    expect(() => categoria('categoria-apagada')).not.toThrow();
  });

  it('preserva o id, para a linha continuar recategorizável', () => {
    const orfa = categoria('categoria-apagada');
    expect(orfa.id).toBe('categoria-apagada');
    expect(orfa.nome).toBe('Sem categoria');
  });

  it('não contamina o catálogo', () => {
    const antes = Object.keys(categorias).length;
    categoria('categoria-apagada');
    expect(Object.keys(categorias)).toHaveLength(antes);
    expect(categoriaExiste('categoria-apagada')).toBe(false);
    expect(categoriaExiste('mercado')).toBe(true);
  });

  it('continua devolvendo a categoria real quando ela existe', () => {
    expect(categoria('mercado').nome).toBe('Mercado');
  });
});
