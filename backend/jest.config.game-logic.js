/** @type {import('jest').Config} */
export default {
  displayName: 'Game Logic Tests',
  verbose: false,
  testEnvironment: 'node',
  maxWorkers: 1, // Serial execution for database safety
  testTimeout: 30000, // Extended timeout for complex game logic and concurrent tests
  globalSetup: '<rootDir>/jest.globalSetup.cjs',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  globalTeardown: '<rootDir>/jest.teardown.cjs',
  
  // Test pattern for game logic tests
  testMatch: [
    '**/test/shots.test.js',
    '**/test/events.test.js',
    '**/test/possessions.test.js',
    '**/test/substitutions.test.js',
    '**/test/match-events.test.js',
    '**/test/game-rosters.test.js',
    '**/test/timer.test.js'
  ],
  
  // Use different database name for isolation
  setupFiles: ['<rootDir>/jest.setup.game-logic.cjs'],
  
  // Optimized test reporting
  reporters: [
    ['default', { 
      silent: false,
      verbose: false,
      summaryThreshold: 15
    }]
  ],
  
  bail: false,
  collectCoverageFrom: [
    'src/routes/shots.js',
    'src/routes/events.js', 
    'src/routes/possessions.js',
    'src/routes/substitutions.js',
    'src/routes/match-events.js',
    'src/routes/game-rosters.js',
    'src/routes/timer.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage/game-logic',
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
  cacheDirectory: '<rootDir>/.jest-cache/game-logic',
  maxConcurrency: 1,
  
  // Worker management for better cleanup
  forceExit: true,
  detectOpenHandles: false,
  
  // Better test organization
  testSequencer: '<rootDir>/jest.sequencer.cjs',
  
  // Faster file watching and processing
  watchman: false,
  
  // Optimize module resolution
  haste: {
    computeSha1: false,
    enableSymlinks: false
  }
};