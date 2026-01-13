import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import 'fake-indexeddb/auto';

// Mock fetch globally
// @ts-expect-error - test-only global shim
globalThis.fetch = vi.fn();

// Mock window.confirm for tests
// @ts-expect-error - test-only global shim
globalThis.confirm = vi.fn(() => true);

// Mock localStorage if not available
if (typeof Storage === 'undefined') {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  // @ts-expect-error - Adding to global for testing
  globalThis.localStorage = localStorageMock;
}

// Mock ServiceWorkerRegistration
class MockServiceWorkerRegistration {
  sync = {
    register: vi.fn().mockResolvedValue(undefined)
  };
}

// @ts-expect-error - Adding to global for testing
globalThis.ServiceWorkerRegistration = MockServiceWorkerRegistration;

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});