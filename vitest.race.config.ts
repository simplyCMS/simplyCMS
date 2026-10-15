import { defineConfig } from 'vitest/config';

// Окремий контур `pnpm test:race`: тест запускає ВКЛАДЕНІ прогони vitest
// (секунди на кожен), тому в дефолтний `pnpm test` не входить.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/race-teardown/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
