// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
// Desliga regras de formatação que conflitam com o Prettier — o Prettier
// formata, o ESLint cuida de correção. Precisa vir por último.
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      '.bundle-check/*',
      '.bundle-ios/*',
      // Fonte importada do Claude Design: é referência, não código nosso.
      'design/*',
    ],
  },
  {
    rules: {
      // Dinheiro é sempre centavo inteiro; um `==` frouxo aqui vira bug de valor.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },
  {
    // O que não está no estado não tem como ser persistido. `seed` é semente do
    // estado inicial, não fonte de consulta: quem lê dele é só o `store`.
    files: ['src/telas/**', 'src/componentes/**', 'src/estado/derivados.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/dominio/seed'],
              message:
                'Leia de `estado.*`, não da semente. Se o dado não existe no Estado, ele precisa entrar lá primeiro — senão não dá para persistir.',
            },
          ],
        },
      ],
    },
  },
  {
    // O domínio é a camada que os testes conseguem exercitar sem montar nada.
    files: ['src/dominio/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'O domínio não conhece a camada de UI.' },
            { name: 'react-native', message: 'O domínio não conhece a camada de UI.' },
          ],
        },
      ],
    },
  },
  prettierConfig,
]);
