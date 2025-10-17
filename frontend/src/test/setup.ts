import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock fetch globally
global.fetch = vi.fn();

// Mock environment variables
vi.mock('./env.ts', () => ({
  API_URL: 'http://localhost:3001/api',
}));

// Clean up after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});