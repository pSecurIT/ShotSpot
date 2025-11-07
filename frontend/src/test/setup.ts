import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import 'fake-indexeddb/auto';

// Mock fetch globally
global.fetch = vi.fn();

// Mock window.confirm for tests
global.confirm = vi.fn(() => true);

// Mock localStorage if not available
if (typeof Storage === 'undefined') {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  // @ts-expect-error - Adding to global for testing
  global.localStorage = localStorageMock;
}

// Mock ServiceWorkerRegistration
class MockServiceWorkerRegistration {
  sync = {
    register: vi.fn().mockResolvedValue(undefined)
  };
}

// @ts-expect-error - Adding to global for testing
global.ServiceWorkerRegistration = MockServiceWorkerRegistration;

// Mock environment variables
vi.mock('./env.ts', () => ({
  API_URL: 'http://localhost:3001/api',
}));

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});