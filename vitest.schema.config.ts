import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import {
  harnessServicesEnv,
  loadHarnessEnv,
  SERVICE_KEYS,
} from './scripts/harness-env.mjs';

// Окремий конфіг для schema-гейта `test:schema` (Task 1, план В2-К1а).
//
// Suite потребує живого Postgres (`PG_HARNESS_URL` — CI service-контейнер
// чи локальний кластер розробника; фолбек — ефемерний `initdb`+`pg_ctl` у
// tmp-теці), тому `vitest.config.ts` (звичайний `pnpm test`) виключає
// `test-harness/**` — та сама логіка, що й у `vitest.packaging.config.ts`:
// гейт із передумовою живе окремим конфігом, бо в vitest 4 CLI-прапорець
// `--exclude` ДОПОВНЮЄ `test.exclude`, а не заміщає його.
//
// React-плагін тут не потрібен: сюїта не рендерить нічого. А от аліас ядра —
// потрібен (з Task 6): гейт `with-actor` міряє САМ рантайм `simplycms/db`
// проти харнеса, а не тестову копію контракту. 🔴 Один base-prefix ключ,
// як у `vitest.config.ts`: `@rollup/plugin-alias` матчить і `simplycms`, і
// `simplycms/<sub>`, але не сторонні `simplycms-*`.
// `.env.harness` (pnpm harness:up) — лише якщо PG_HARNESS_URL не задано явно
// і контейнер запущений (див. scripts/harness-env.mjs).
loadHarnessEnv(import.meta.dirname);

// 🔴 Два проєкти, бо `S3_*` змінюють поведінку ядра: `getMediaDriver()` бере s3, коли
// група повна. Усе pg-крило (`diskKeys()`, стирання файлів на диску) побудоване на
// `local-fs`, тож воно бачить `S3_*` порожніми (порожнє = «не задано» для
// `resolveDriverEnv`), а ключі Garage отримує лише контрактний набір драйверів.
const blankS3 = Object.fromEntries(SERVICE_KEYS.map((k) => [k, '']));
const common = {
  environment: 'node',
  // Ефемерний фолбек-кластер піднімається й гаситься на файл — паралельні
  // файли билися б за той самий вільний порт і tmp-теку.
  fileParallelism: false,
  testTimeout: 60_000,
  hookTimeout: 60_000,
} as const;

export default defineConfig({
  resolve: {
    alias: {
      simplycms: resolve(import.meta.dirname, 'packages/simplycms/src'),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          ...common,
          name: 'pg',
          include: ['packages/simplycms/test-harness/**/*.test.ts'],
          exclude: ['packages/simplycms/test-harness/storage/**'],
          env: blankS3,
        },
      },
      {
        extends: true,
        test: {
          ...common,
          name: 'storage',
          include: ['packages/simplycms/test-harness/storage/**/*.test.ts'],
          env: harnessServicesEnv(import.meta.dirname),
        },
      },
    ],
  },
});
