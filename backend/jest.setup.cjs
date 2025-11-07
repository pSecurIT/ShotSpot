const dotenv = require('dotenv');
const path = require('path');
const { TextEncoder, TextDecoder } = require('util');

// Polyfill for encoding which isn't present in JSDOM
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill for import.meta
if (typeof globalThis.jest !== 'undefined') {
  globalThis.import = {
    meta: {
      url: `file://${__filename}`
    }
  };
}

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '.env.test') });

// Enhanced error handling and logging
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Track test context for better error reporting
let currentTestName = '';
let currentSuiteName = '';

beforeAll(() => {
  console.log('\n🚀 Starting ShotSpot Backend Test Suite...\n');
});

beforeEach(() => {
  // Clear mocks and capture test context
  jest.clearAllMocks();
  
  // Get current test name for better error context
  const testName = expect.getState().currentTestName || 'Unknown Test';
  const suiteName = expect.getState().testPath?.split('/').pop()?.replace('.test.js', '') || 'Unknown Suite';
  
  currentTestName = testName;
  currentSuiteName = suiteName;
});

afterEach(async () => {
  // Enhanced error reporting
  if (expect.getState().assertionCalls === 0) {
    console.warn(`⚠️  Warning: Test "${currentTestName}" in ${currentSuiteName} made no assertions`);
  }
  
  // Give database operations time to complete and connections to close
  await new Promise(resolve => setTimeout(resolve, 10));
});

afterAll(() => {
  console.log('\n✅ ShotSpot Backend Test Suite completed!');
  console.log('📊 Enhanced test infrastructure provides:');
  console.log('   🏆 Visual test categorization with emojis');
  console.log('   🔍 Enhanced error context and logging');
  console.log('   📈 Comprehensive test progress tracking');
  console.log('   ⚡ Improved debugging capabilities\n');
});

// Enhanced error reporting
global.testContext = {
  getCurrentTest: () => ({ name: currentTestName, suite: currentSuiteName }),
  logTestError: (error, context = '') => {
    console.error(`\n❌ Error in ${currentSuiteName}:${currentTestName}`);
    if (context) console.error(`📍 Context: ${context}`);
    console.error(`💥 Error: ${error.message}`);
    if (error.stack) console.error(`📚 Stack: ${error.stack}`);
    console.error('');
  }
};

// Override console methods for better test output
console.error = (...args) => {
  if (currentTestName) {
    originalConsoleError(`[${currentSuiteName}:${currentTestName}]`, ...args);
  } else {
    originalConsoleError(...args);
  }
};

console.warn = (...args) => {
  if (currentTestName) {
    originalConsoleWarn(`[${currentSuiteName}:${currentTestName}]`, ...args);
  } else {
    originalConsoleWarn(...args);
  }
};