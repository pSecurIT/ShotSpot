/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { configDefaults } from 'vitest/config';

const shouldServeSpaEntry = (requestUrl: string | undefined, acceptHeader: string | undefined): boolean => {
  if (!requestUrl || !acceptHeader?.includes('text/html')) {
    return false;
  }

  const path = requestUrl.split('?')[0];

  if (
    path.startsWith('/api/') ||
    path.startsWith('/@') ||
    path.startsWith('/__vite') ||
    path.startsWith('/__cypress') ||
    path.startsWith('/cypress/') ||
    path.startsWith('/src/') ||
    path.startsWith('/assets/') ||
    path === '/favicon.ico'
  ) {
    return false;
  }

  return !/\.[a-z0-9]+$/i.test(path);
};

const spaFallbackPlugin = {
  name: 'shotspot-spa-fallback',
  configureServer(server: { middlewares: { use: (handler: (req: { method?: string; url?: string; headers: Record<string, string | string[] | undefined> }, _res: unknown, next: () => void) => void) => void } }) {
    server.middlewares.use((req, _res, next) => {
      if (['GET', 'HEAD'].includes(req.method || '') && shouldServeSpaEntry(req.url, typeof req.headers.accept === 'string' ? req.headers.accept : undefined)) {
        req.url = '/';
      }

      next();
    });
  },
  configurePreviewServer(server: { middlewares: { use: (handler: (req: { method?: string; url?: string; headers: Record<string, string | string[] | undefined> }, _res: unknown, next: () => void) => void) => void } }) {
    server.middlewares.use((req, _res, next) => {
      if (['GET', 'HEAD'].includes(req.method || '') && shouldServeSpaEntry(req.url, typeof req.headers.accept === 'string' ? req.headers.accept : undefined)) {
        req.url = '/index.html';
      }

      next();
    });
  }
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), spaFallbackPlugin],
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/recharts/')) return 'charts';
            if (id.includes('/socket.io-client/')) return 'realtime';
            if (id.includes('/html2canvas/') || id.includes('/jspdf/')) return 'export';
            return 'vendor';
          }
        }
      }
    },
    outDir: 'dist',
  },
  publicDir: 'public',
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
    open: process.env.CYPRESS !== '1',
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