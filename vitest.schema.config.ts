import { defineConfig } from 'vitest/config';

// Окремий конфіг для schema-гейта `test:schema` (Task 1, план В2-К1а).
//
// Suite потребує живого Postgres (`PG_HARNESS_URL` — CI service-контейнер
// чи локальний кластер розробника; фолбек — ефемерний `initdb`+`pg_ctl` у
// tmp-теці), тому `vitest.config.ts` (звичайний `pnpm test`) виключає
// `test-harness/**` — та сама логіка, що й у `vitest.packaging.config.ts`:
// гейт із передумовою живе окремим конфігом, бо в vitest 4 CLI-прапорець
// `--exclude` ДОПОВНЮЄ `test.exclude`, а не заміщає його.
//
// Аліаси й react-плагін не потрібні: сюїта говорить із Postgres напряму
// через `pg`, коду фреймворку не імпортує.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/simplycms/test-harness/**/*.test.ts'],
    // Ефемерний фолбек-кластер піднімається й гаситься на файл — паралельні
    // файли билися б за той самий вільний порт і tmp-теку.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
