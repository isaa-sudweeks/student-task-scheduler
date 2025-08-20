import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      // Stub heavy browser-only libs in unit tests
      'recharts': resolve(__dirname, 'src/test/recharts.mock.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    // Ensure stability in constrained environments
    pool: 'threads',
    maxWorkers: 1,
    minWorkers: 1,
    setupFiles: ['src/test/setup.ts'],
    // Prevent runaway watchers and memory use on large folders
    watch: false,
    watchExclude: [
      '**/.next/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/tsconfig.tsbuildinfo',
    ],
    // Keep Vitest from crawling generated/output directories
    exclude: [
      'node_modules',
      'dist',
      'build',
      'coverage',
      '.next',
      '**/.next/**',
      'e2e/**',
    ],
  },
});
