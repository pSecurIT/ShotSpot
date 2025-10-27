/** @type {import('jest').Config} */
export default {
  verbose: true,
  testEnvironment: 'node',
  maxWorkers: 1, // Run tests serially to avoid database conflicts
  testTimeout: 15000, // Increase timeout for database operations
  transform: {
    '^.+\\.js$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }]
        ],
        plugins: [
          '@babel/plugin-syntax-import-attributes',
          ['babel-plugin-transform-import-meta', { module: 'ES6' }]
        ]
      }
    ]
  },
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'jsx', 'json'],
  testEnvironmentOptions: {
    url: 'http://localhost'
  },
  rootDir: '.',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  globalTeardown: '<rootDir>/jest.teardown.cjs',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(supertest|express|pg)/)'
  ],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/app.js',
    '!src/config/*.js'
  ],
  coverageDirectory: 'coverage',
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};