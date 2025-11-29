/** @type {import('jest').Config} */
export default {
  verbose: false, // Reduce verbosity for faster execution
  testEnvironment: 'node',
  maxWorkers: 1, // Run tests serially to avoid database conflicts
  testTimeout: 10000, // Reduced timeout for faster failure detection
  globalSetup: '<rootDir>/jest.globalSetup.cjs',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  globalTeardown: '<rootDir>/jest.teardown.cjs',
  
  // Optimized test reporting
  reporters: [
    ['default', { 
      silent: false,
      verbose: false,
      summaryThreshold: 10 
    }]
  ],
  
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
        ],
        // Prevent babel-plugin-istanbul from being auto-injected during coverage
        env: {
          test: {
            plugins: []
          }
        }
      }
    ]
  },
  // Use Jest's built-in coverage instead of babel-plugin-istanbul
  coverageProvider: 'v8',
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
  testSequencer: '<rootDir>/jest.sequencer.cjs',
  
  // Performance optimizations
  cacheDirectory: '<rootDir>/.jest-cache',
  maxConcurrency: 1, // Ensure serial execution
  
  // Faster file watching and processing
  watchman: false, // Disable watchman for faster startup
  
  // Optimize module resolution
  haste: {
    computeSha1: false,
    enableSymlinks: false
  }
};