import { defineConfig, mergeConfig } from 'vitest/config';
import base from '../../vitest.config';

/**
 * Конфіг ПІДПРОГОНУ гонки: базовий конфіг репо + середовище-форсер. Підхоплює
 * лише згенеровані `*.race-copy.tsx` і `*.race-wait.ts` (за дефолтним include
 * `pnpm test` їх не бачить).
 */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      environment: './tests/race-teardown/race-teardown-env.ts',
      include: ['**/*.race-copy.tsx', '**/*.race-wait.ts'],
    },
  }),
);
