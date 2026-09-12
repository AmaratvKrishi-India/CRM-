import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    // Node-based unit tests are run by scripts/run-tests.ts. Vitest owns the
    // explicitly Vitest-authored suites so the two runners do not execute the
    // same files with different globals and lifecycle semantics.
    include: ['tests/integration/**/*.test.ts', 'tests/services/**/*.test.ts', 'tests/db/**/*.test.ts', 'tests/utils/**/*.test.ts'],
    exclude: [
      'tests/**/*.e2e.ts',
      'tests/visual/**',
      'tests/**/*.bench.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      reportsDirectory: './coverage',
      exclude: [
        'tests/**',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.stories.tsx',
        'src/**/*.test.tsx',
        'src/**/*.test.ts'
      ],
      // Vitest owns the focused integration/service subset. The broader
      // application regression suite runs through Node's test runner, so a
      // global threshold here would measure only part of the product and
      // fail for untested UI modules rather than reveal a real regression.
      watermarks: {
        lines: [50, 80],
        functions: [50, 80],
        branches: [50, 70],
        statements: [50, 80]
      }
    },
    testTimeout: 15000,
    hookTimeout: 10000,
    teardownTimeout: 5000,
    isolate: true,
    pool: 'threads',
    singleThread: true,
    maxWorkers: 1,
    minWorkers: 1,
    sequence: {
      shuffle: false,
      hooks: 'list'
    },
    retry: 0,
    bail: 0,
    fileParallelism: false,
    passWithNoTests: false,
    logHeapUsage: false,
    benchmark: {
      include: ['tests/**/*.bench.ts'],
      exclude: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
      reporters: ['verbose', 'json'],
      outputFile: './benchmark-results.json'
    },
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      VITE_SUPABASE_URL: 'http://127.0.0.1:15432',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key'
    },
    reporters: ['verbose', 'json', 'html'],
    outputFile: './test-results.json'
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, './src'),
      '@services': resolve(projectRoot, './src/services'),
      '@components': resolve(projectRoot, './src/components'),
      '@context': resolve(projectRoot, './src/context'),
      '@db': resolve(projectRoot, './src/db')
    }
  },
  define: {
    'import.meta.vitest': 'undefined'
  }
});
