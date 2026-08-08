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
  prettierConfig,
]);
