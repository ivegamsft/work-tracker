import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.{ts,tsx}'],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
