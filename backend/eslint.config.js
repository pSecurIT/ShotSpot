import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'dist/**', '.eslintrc.json'],
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
        bcrypt: 'readonly',  // bcrypt is imported via dynamic import
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-console': 'off',
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
    },
  },
  {
    // Enforce centralized safe logging in backend source files.
    files: ['src/**/*.js'],
    ignores: ['src/utils/logger.js'],
    rules: {
      'no-console': 'error'
    },
  },
  {
    files: ['**/*.test.js', '**/*.spec.js', 'test/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    // CommonJS files
    files: ['**/*.cjs', 'jest.*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.commonjs,
      },
    },
  },
];
