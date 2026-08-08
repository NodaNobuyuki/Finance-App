import {
  comSinal,
  deDigitos,
  deTextoLivre,
  empilharDigitos,
  formatar,
  formatarRedondo,
  percentual,
  renderPor,
} from '../dinheiro';

describe('formatar', () => {
  it('mostra centavos com vírgula e milhar com ponto', () => {
    expect(formatar(28790)).toBe('R$ 287,90');
    expect(formatar(680000)).toBe('R$ 6.800,00');
    expect(formatar(123456789)).toBe('R$ 1.234.567,89');
  });

  it('sempre mostra dois decimais', () => {
    expect(formatar(5)).toBe('R$ 0,05');
    expect(formatar(50)).toBe('R$ 0,50');
    expect(formatar(0)).toBe('R$ 0,00');
  });

  it('formata o módulo — o sinal é de quem chama', () => {
    expect(formatar(-28790)).toBe('R$ 287,90');
  });
});

describe('comSinal', () => {
  it('usa menos tipográfico na saída e mais na entrada', () => {
    expect(comSinal(-28790)).toBe('− R$ 287,90');
    expect(comSinal(162000)).toBe('+ R$ 1.620,00');
  });
});

describe('formatarRedondo', () => {
  it('esconde os centavos nos atalhos de registro', () => {
    expect(formatarRedondo(2000)).toBe('R$ 20');
    expect(formatarRedondo(150000)).toBe('R$ 1.500');
  });
});

describe('deDigitos', () => {
  it('lê a fila do teclado como centavos', () => {
    expect(deDigitos('2879')).toBe(2879);
    expect(deDigitos('')).toBe(0);
    expect(deDigitos('0')).toBe(0);
  });
});

describe('empilharDigitos', () => {
  it('descarta zeros à esquerda e limita o tamanho', () => {
    expect(empilharDigitos('', '0')).toBe('');
    expect(empilharDigitos('12', '5')).toBe('125');
    expect(empilharDigitos('123456789', '0')).toBe('123456789');
  });
});

describe('deTextoLivre', () => {
  it('lê o formato pt-BR', () => {
    expect(deTextoLivre('1.234,56')).toBe(123456);
    expect(deTextoLivre('89,9')).toBe(8990);
    expect(deTextoLivre('R$ 42,00')).toBe(4200);
  });

  it('aceita ponto decimal', () => {
    expect(deTextoLivre('1234.56')).toBe(123456);
  });

  it('trata 3 dígitos depois do separador como milhar', () => {
    expect(deTextoLivre('1.234')).toBe(123400);
    expect(deTextoLivre('1,234')).toBe(123400);
  });

  it('devolve 0 para entrada que não dá para interpretar', () => {
    expect(deTextoLivre('')).toBe(0);
    expect(deTextoLivre('abc')).toBe(0);
  });

  it('nunca devolve fração de centavo', () => {
    for (const t of ['1.234,56', '0,01', '999,999', '12,3']) {
      expect(Number.isInteger(deTextoLivre(t))).toBe(true);
    }
  });
});

describe('renderPor', () => {
  it('devolve inteiro, arredondando só no fim', () => {
    const r = renderPor(1500000, 88, 60);
    expect(Number.isInteger(r)).toBe(true);
    expect(r).toBeGreaterThan(1500000);
  });

  it('não rende sobre valor zero ou negativo', () => {
    expect(renderPor(0, 88, 60)).toBe(0);
    expect(renderPor(-100, 88, 60)).toBe(0);
  });
});

describe('percentual', () => {
  it('protege contra divisão por zero', () => {
    expect(percentual(100, 0)).toBe(0);
    expect(percentual(5000, 10000)).toBe(50);
  });
});
