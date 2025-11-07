/** @type {import('jest').Config} */
export default {
  // Jest Projects for parallel execution
  projects: [
    './jest.config.unit.js',      // Unit tests - can run fully parallel
    './jest.config.core-api.js',  // Core API tests - serial within group  
    './jest.config.game-logic.js' // Game logic tests - serial within group
  ],
  
  // Global configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',
    '!src/config/*.js'
  ],
  
  coverageDirectory: 'coverage/parallel',
  coverageReporters: ['text', 'text-summary', 'html', 'clover'],
  
  // Performance settings
  maxWorkers: '50%', // Use half of available CPU cores
  
  // Global reporters
  reporters: ['default'],
  
  // Fail fast on critical errors
  bail: false,
  
  // Enhanced output formatting
  displayName: {
    name: 'ShotSpot Backend Parallel',
    color: 'magenta'
  },
  
  verbose: false
};