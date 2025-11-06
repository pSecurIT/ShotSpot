/** @type {import('jest').Config} */
export default {
  verbose: true,
  testEnvironment: 'node',
  maxWorkers: 1, // Run tests serially to avoid database conflicts
  testTimeout: 15000, // Increase timeout for database operations
  globalSetup: '<rootDir>/jest.globalSetup.cjs',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  globalTeardown: '<rootDir>/jest.teardown.cjs',
  
  // Enhanced test reporting for clarity
  reporters: ['default'],
  
  // Better error handling and output
  bail: false, // Don't stop on first failure
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/app.js',
    '!src/config/*.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'html', 'clover'],
  
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
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(supertest|express|pg)/)'
  ],
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Enhanced output formatting
  displayName: {
    name: 'ShotSpot Backend',
    color: 'blue'
  },
  
  // Better test organization
  testSequencer: '<rootDir>/jest.sequencer.cjs'
};