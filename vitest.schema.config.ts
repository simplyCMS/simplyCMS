import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import {
  harnessMailEnv,
  harnessServicesEnv,
  loadHarnessEnv,
  MAIL_KEYS,
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
// Так само `SMTP_URL`/`MAIL_FROM` (Task 9): pg-крило лишається на драйвері пошти `log`.
const blankS3 = Object.fromEntries(
  [...SERVICE_KEYS, ...MAIL_KEYS].map((k) => [k, '']),
);
// Фіксована база посилань для листів: place-order fail-loud без VITE_SITE_URL (Р18),
// а CI його не задає — значення не береться ні з оточення, ні з `.env.local`.
const SITE_URL = 'http://store.test';
const common = {
  environment: 'node',
  // Ефемерний фолбек-кластер піднімається й гаситься на файл — паралельні
  // файли билися б за той самий вільний порт і tmp-теку.
  fileParallelism: false,
  testTimeout: 60_000,
  hookTimeout: 60_000,
} as const;

export default defineConfig({
  // 🔴 Гейт не читає `.env*` розробника (Р31): інакше `VITE_SITE_URL` з `.env.local`
  // робив би його зеленим лише локально. Env проєктів — лише явний `test.env`.
  envDir: false,
  resolve: {
    alias: {
      simplycms: resolve(import.meta.dirname, 'packages/simplycms/src'),
    },
  },
  test: {
    // Ролі кластера — один раз до паралельних накатів (`global-roles.mjs`).
    globalSetup: ['packages/simplycms/test-harness/pg/global-roles.mjs'],
    projects: [
      {
        extends: true,
        test: {
          ...common,
          name: 'pg',
          include: ['packages/simplycms/test-harness/**/*.test.ts'],
          exclude: [
            'packages/simplycms/test-harness/storage/**',
            'packages/simplycms/test-harness/mail/**',
          ],
          env: { ...blankS3, VITE_SITE_URL: SITE_URL },
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
      {
        extends: true,
        test: {
          ...common,
          name: 'mail',
          include: ['packages/simplycms/test-harness/mail/**/*.test.ts'],
          env: harnessMailEnv(import.meta.dirname),
        },
      },
    ],
  },
});
