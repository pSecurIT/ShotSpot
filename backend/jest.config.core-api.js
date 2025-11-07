/** @type {import('jest').Config} */
export default {
  displayName: 'Core API Tests',
  verbose: false,
  testEnvironment: 'node',
  maxWorkers: 1, // Serial execution for database safety
  testTimeout: 20000, // Increased timeout for API tests with database operations
  globalSetup: '<rootDir>/jest.globalSetup.cjs',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  globalTeardown: '<rootDir>/jest.teardown.cjs',
  
  // Test pattern for core API tests
  testMatch: [
    '**/test/health.test.js',
    '**/test/auth.test.js', 
    '**/test/users.test.js',
    '**/test/teams.test.js',
    '**/test/players.test.js',
    '**/test/games.test.js'
  ],
  
  // Use different database name for isolation
  setupFiles: ['<rootDir>/jest.setup.core-api.cjs'],
  
  // Optimized test reporting
  reporters: [
    ['default', { 
      silent: false,
      verbose: false,
      summaryThreshold: 10 
    }]
  ],
  
  bail: false,
  collectCoverageFrom: [
    'src/routes/health.js',
    'src/routes/auth.js',
    'src/routes/users.js',
    'src/routes/teams.js',
    'src/routes/players.js',
    'src/routes/games.js',
    'src/middleware/auth.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage/core-api',
  coverageReporters: ['text-summary', 'html'],
  
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
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Performance optimizations
  cacheDirectory: '<rootDir>/.jest-cache/core-api',
  maxConcurrency: 1,
  
  // Worker management for better cleanup
  forceExit: true,
  detectOpenHandles: false,
  
  // Faster file watching and processing
  watchman: false,
  
  // Optimize module resolution
  haste: {
    computeSha1: false,
    enableSymlinks: false
  }
};