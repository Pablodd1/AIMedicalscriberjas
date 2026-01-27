import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    include: ['tests/unit/**/*.test.ts', 'server/tests/**/*.test.ts'],
    exclude: ['tests/e2e/**/*', 'node_modules', 'dist'],
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
