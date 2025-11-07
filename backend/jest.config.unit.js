/** @type {import('jest').Config} */
export default {
  displayName: 'Unit Tests',
  verbose: false,
  testEnvironment: 'node',
  maxWorkers: 2, // Can run in parallel - no DB conflicts
  testTimeout: 10000, // Increased timeout for CSRF and validation tests
  
  // Test pattern for unit tests (no database dependencies)
  testMatch: [
    '**/test/validateEnv.test.js',
    '**/test/errorNotification.test.js',
    '**/test/csrf.test.js'
  ],
  
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],
  
  // Optimized for speed
  reporters: [
    ['default', { 
      silent: false,
      verbose: false,
      summaryThreshold: 5 
    }]
  ],
  
  bail: false,
  collectCoverageFrom: [
    'src/utils/*.js',
    'src/middleware/csrf.js',
    '!src/index.js',
    '!src/app.js'
  ],
  coverageDirectory: 'coverage/unit',
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
  cacheDirectory: '<rootDir>/.jest-cache/unit',
  maxConcurrency: 5,
  
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