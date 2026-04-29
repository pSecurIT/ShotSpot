import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import 'fake-indexeddb/auto';

const IGNORED_TEST_WARNINGS = [
  'not wrapped in act(...)',
  'Encountered two children with the same key',
  'Not implemented: navigation to another Document',
];

const shouldIgnoreWarning = (args: unknown[]): boolean => {
  const message = args
    .map((arg) => (typeof arg === 'string' ? arg : ''))
    .join(' ');

  return IGNORED_TEST_WARNINGS.some((entry) => message.includes(entry));
};

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalStderrWrite = process.stderr.write.bind(process.stderr) as typeof process.stderr.write;

const IGNORED_STDERR_WARNINGS = [
  'Not implemented: navigation to another Document',
];

console.error = (...args: unknown[]) => {
  if (shouldIgnoreWarning(args)) {
    return;
  }
  originalConsoleError(...args);
};

console.warn = (...args: unknown[]) => {
  if (shouldIgnoreWarning(args)) {
    return;
  }
  originalConsoleWarn(...args);
};

process.stderr.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
  const message = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
  if (IGNORED_STDERR_WARNINGS.some((entry) => message.includes(entry))) {
    return true;
  }

  return originalStderrWrite(
    chunk,
    ...(args as Parameters<typeof process.stderr.write> extends [
      string | Uint8Array,
      ...infer Rest
    ]
      ? Rest
      : never)
  );
}) as typeof process.stderr.write;

// Mock fetch globally
globalThis.fetch = vi.fn();

// Mock window.confirm for tests
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