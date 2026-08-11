import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 4300);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Playwright Test — автоматизований браузерний контур поверх ручного смоку
 * (`docs/architecture/test-contours.md` §8). Єдиний вхід — `pnpm test:e2e`
 * (`scripts/e2e.mjs`): він піднімає локальний Supabase-стек, накатує сід,
 * створює власника-адміна і ЛИШЕ ТОДІ запускає `playwright test` дочірнім
 * процесом — двічі, послідовно, під `VITE_LOCALE=uk-UA` і `en-US`.
 *
 * 🔴 `webServer` тут навмисно НЕ піднімає БД сам: Playwright стартує
 * `webServer` у фазі `createPluginSetupTasks` — РАНІШЕ за будь-який
 * `globalSetup`. Якби стек піднімав `globalSetup`, змінні `VITE_SUPABASE_*`
 * не встигли б потрапити в env процесу `vite dev` — він успадковує env від
 * батьківського `playwright test` у МОМЕНТ СТАРТУ, а не пізніше. Тому весь
 * bootstrap живе поза Playwright, у зовнішньому оркестраторі.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.e2e\.ts$/,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Один dev-сервер і одна БД на всі специ — паралельні воркери означали б
  // гонки за той самий стан (перемикач теми/плагіна, сесія власника).
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Локальний бінарник, не `pnpm dev`: конфіг лишається відтворюваним,
    // навіть якщо хтось перевизначить скрипт `dev` у `package.json`.
    command: `node_modules/.bin/vite dev --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 90_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'layout-desktop',
      testMatch: /layout-overflow\.e2e\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: 'layout-mobile',
      testMatch: /layout-overflow\.e2e\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'admin-smoke',
      testMatch: /admin-smoke\//,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
});
