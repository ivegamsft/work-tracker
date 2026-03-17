import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/smoke/**/*.smoke.test.ts'],
    testTimeout: 10000, // 10s timeout for smoke tests
    hookTimeout: 10000,
    globals: false,
    environment: 'node',
  },
});
