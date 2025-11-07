/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'], 
      exclude: [
        'node_modules/',
        'src/test/',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/setupTests.ts',
        'src/vite-env.d.ts',
        'src/env.d.ts',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/**',
        'dist/**',
        '.vite/**',
        'src/img/**'
      ],
      thresholds: {
        global: {
          branches: 50,
          functions: 50,
          lines: 50,
          statements: 50
        }
      },
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      skipFull: false,
      watermarks: {
        lines: [50, 80],
        functions: [50, 80],
        branches: [50, 80],
        statements: [50, 80]
      }
    },
    pool: 'forks',
    testTimeout: 10000,
    hookTimeout: 10000
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    },
    host: true, // Listen on all addresses
    ...(process.env.NODE_ENV === 'production' ? {
      host: 'localhost',
      strictPort: true,
    } : {})
  },
});