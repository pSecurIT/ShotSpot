import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        bcrypt: 'readonly',
        require: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-console': 'off',
      indent: 'off', // Disabled to avoid conflicts with existing code style
      quotes: 'off', // Disabled to allow both single and double quotes
      semi: ['error', 'always']
    }
  },
  {
    files: ['**/*.test.js', '**/*.spec.js', 'test/**/*.js', 'src/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        jest: 'readonly'
      }
    }
  },
  {
    // CommonJS files
    files: ['**/*.cjs', 'jest.*.cjs', 'scripts/pre-deploy.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'writable',
        exports: 'writable',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        console: 'readonly',
        beforeEach: 'readonly',
        jest: 'readonly'
      }
    }
  },
  {
    ignores: ['node_modules/**', 'coverage/**', 'dist/**', '.eslintrc.json']
  }
];
