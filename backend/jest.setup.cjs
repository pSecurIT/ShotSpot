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

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});