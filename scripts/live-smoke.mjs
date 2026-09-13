#!/usr/bin/env node
/**
 * Живий прогін вітрини — DoD К2-Е0 як скрипт, не як таблиця (Е0-8).
 *
 * Що доводить і чим: (1) curl+SQL — той самий `gateHttp` пілота (SSR, sitemap,
 * robots, health, guard); (2) браузер — те, чого curl не бачить: реєстрація
 * покупця, бейдж наявності після гідратації, JSON-LD, автовибір єдиної точки
 * видачі, сама воронка картка → кошик → чекаут → рядок в `orders` ЗІ
 * СПИСАННЯМ і рівністю «підсумок = замовлення» (М-12), скасування в кабінеті
 * З ПОВЕРНЕННЯМ залишку і статусу, і нуль `pageerror` на всіх сторінках
 * включно з `order-success` і кабінетом (усі форматують `Date` через `Intl`).
 * Друкує таблицю — §12 test-contours.md посилається сюди замість рукопису.
 *
 * Потребує: Postgres (`PG_HARNESS_URL`, адмін-доступ до кластера — як
 * `pnpm db:demo`) і Chromium для Playwright (`pnpm exec playwright install
 * chromium` — on-demand, як jsdom для theme:conformance). Не CI — місце в
 * гейтах релізу (окреме рішення) і в К6 як Gate B на Postgres.
 *
 * 🔴 `.env.local` не чіпається: env збірки й сервера — явний параметр, а
 * `loadEnv`/`server.mjs` беруть файл лише для відсутніх ключів.
 *
 *   PG_HARNESS_URL=postgresql://user@127.0.0.1:5432/postgres pnpm live:smoke
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { startStore, freePort } from './pilot-pack/build.mjs';
import { gateHttp } from './pilot-pack/gate-b.mjs';
import { runFunnel } from './live-smoke/funnel.mjs';
import { withDbName } from '../packages/simplycms/test-harness/pg/apply.mjs';

const ROOT = join(import.meta.dirname, '..');
const DB_NAME = 'simplycms_live_smoke';

const adminUrl = process.env.PG_HARNESS_URL;
if (!adminUrl)
  throw new Error(
    '[live-smoke] потрібен PG_HARNESS_URL (адмін-доступ до кластера, як для pnpm db:demo)',
  );

const rows = [];
const check = (label, passed, fact) => {
  rows.push([label, passed ? 'OK' : 'FAIL', fact]);
};

async function main() {
  // 1. Чиста демо-БД (той самий скрипт, що й у доках; існуючу дропає сам).
  execFileSync(
    'node',
    ['scripts/demo-db.mjs', '--url', adminUrl, '--name', DB_NAME],
    { cwd: ROOT, stdio: 'inherit' },
  );
  const dbUrl = withDbName(adminUrl, DB_NAME);
  const port = await freePort();
  // 🔴 Явний env для збірки й сервера: shell/CI можуть нести власні
  // DATABASE_URL/BETTER_AUTH_URL, а server.mjs і loadEnv беруть .env.local
  // лише для відсутніх ключів (M9 аудиту r1) — process.env виграє.
  const env = {
    DATABASE_URL: dbUrl,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
    VITE_SITE_URL: `http://127.0.0.1:${port}`,
  };

  let server;
  let browser;
  const shutdown = async () => {
    // 🔴 Один шлях прибирання для finally і для сигналів: падіння чи Ctrl+C
    // не лишають ні Chromium, ні server.mjs.
    await browser?.close().catch(() => {});
    server?.stop();
  };
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      void shutdown().then(() => process.exit(130));
    });
  }

  try {
    execFileSync('pnpm', ['build'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    server = await startStore(ROOT, port, env);
    const base = `http://127.0.0.1:${port}`;

    // 2. curl+SQL — гейт B пілота як є.
    const http = await gateHttp(port, { DATABASE_URL: dbUrl });
    for (const line of http.details) check('http', line.startsWith('OK'), line);

    // sitemap: кожен lastmod — W3C.
    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    const lastmods = [...sitemap.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map(
      (m) => m[1],
    );
    check(
      'sitemap lastmod W3C',
      lastmods.length > 0 &&
        lastmods.every((v) =>
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v),
        ),
      `${lastmods.length} url, зразок ${lastmods[0] ?? '—'}`,
    );

    // 3. Браузер: реєстрація → картка → кошик → чекаут → скасування.
    const { chromium } = await import('@playwright/test');
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await runFunnel({ page, base, dbUrl, check });

    // 4. Нуль pageerror — у КІНЦІ, коли пройдено всі сторінки: `order-success`
    // і кабінет форматують `Date` через `Intl`, тож рядок замість `Date` на
    // межі RPC дав би тут `RangeError` (поведінковий гейт Е0-2).
    check(
      'pageerror за весь прогін (кошик, order-success, кабінет)',
      errors.length === 0,
      errors.length === 0 ? '0' : errors.join(' | '),
    );
  } finally {
    await shutdown();
  }

  console.log('\n| Перевірка | Результат | Факт |\n|---|---|---|');
  for (const [l, r, f] of rows) console.log(`| ${l} | ${r} | ${f} |`);
  const failed = rows.filter(([, r]) => r === 'FAIL').length;
  console.log(
    `\n${failed === 0 ? 'live-smoke: ЗЕЛЕНИЙ' : `live-smoke: ${failed} FAIL`}`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(`\n[live-smoke] ${e.message}`);
  process.exit(1);
});
