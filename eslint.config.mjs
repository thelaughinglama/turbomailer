import globals from 'globals';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import airbnbBase from 'eslint-config-airbnb-base';
import importPlugin from 'eslint-plugin-import';

export default [

  {
    ignores: ['dist/**'],
  },

  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parser: typescriptParser,
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-shadow': ['error'],
    },
  },

  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: {
      import: importPlugin,
    },
    rules: {
      ...airbnbBase.rules,
    },
  },

  {
    files: ['**/*.test.ts', '**/*.test.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
