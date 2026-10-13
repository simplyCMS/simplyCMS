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
 * включно з `order-success` і кабінетом (усі форматують `Date` через `Intl`);
 * (3) крок каталогу адмінки (К3-Е3) — запрошення власника → пароль → вхід →
 * товар зі СВОЄЮ ціною/залишком/зображенням → вітрина його бачить → дубль
 * slug → тост i18n (Е3-20: доменна помилка серіалізації, не сирий SQL) →
 * видалення прибирає з вітрини (`live-smoke/admin-catalog.mjs`); (4) крок
 * довідників (К3-Е4, `live-smoke/admin-dictionaries.mjs`): розділ, властивість
 * з опцією, призначення, типи цін; (5) замовлення К3-Е5 (`admin-orders.mjs`):
 * два оформлені, одне підтверджене, друге скасоване. Одна сесія власника;
 * (6) CSRF (`live-smoke/csrf.mjs`): POST із чужим Origin на справжню server
 * function і server route `/api/health` → 403 від міддлвари; (7) доставка К3-Е6а
 * (`live-smoke/admin-shipping.mjs`): способи «Самовивіз Е6а» і «Кур'єр», точка,
 * замовлення обома способами, знімок доставки після перейменування точки;
 * (7а) знижки й категорії покупців К3-Е6в (`live-smoke/admin-discounts.mjs`):
 * вкладені групи, поріг «від 3 шт» у картці, кошику й `order_items`, вимкнений
 * батько стримує дитину, автоправило переводить нового покупця у «VIP»;
 * (8) система К3-Е6б (`live-smoke/admin-system.mjs`, ОСТАННІМ): профіль
 * магазину на прогрітому кеші, заміна логотипа, склад, теми (і в тій самій
 * вкладці), плагін — єдиний доказ спільного екземпляра `simplycms/site`.
 * Друкує таблицю — §12 test-contours.md посилається сюди замість рукопису.
 * Повний вивід лягає у `.live-smoke/last.log` (+ `<timestamp>.log`, 10 останніх);
 * при збої наприкінці друкується шлях і рядки FAIL (`live-smoke/log.mjs`).
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
import { applyProbe } from './pilot-pack/apply-probe.mjs';
import { runFunnel } from './live-smoke/funnel.mjs';
import { runOwnerSteps } from './live-smoke/owner-steps.mjs';
import { runCsrfChecks } from './live-smoke/csrf.mjs';
import { runErrorMaskChecks } from './live-smoke/error-mask.mjs';
import { runSecurityHeaderChecks } from './live-smoke/security-headers.mjs';
import { runProductPathChecks } from './live-smoke/product-path.mjs';
import { withDbName } from '../packages/simplycms/test-harness/pg/apply.mjs';
import { runLogged } from './live-smoke/log.mjs';
import { harnessMailEnv, loadHarnessEnv } from './harness-env.mjs';
import { clearMailpit } from './live-smoke/mail.mjs';
import {
  runMailChecks,
  runSignupConfirmation,
} from './live-smoke/mail-steps.mjs';
import { signUp } from './live-smoke/register.mjs';
import { withClientIps } from './live-smoke/client-ip.mjs';

const ROOT = join(import.meta.dirname, '..');

// Зовнішній запуск лише тіпає вивід у `.live-smoke/*.log` і друкує FAIL-рядки
// наприкінці; сам прогін — той самий файл у дочірньому процесі.
if (!process.env.LIVE_SMOKE_LOGGED) {
  process.exit(await runLogged(ROOT, import.meta.filename));
}
const DB_NAME = 'simplycms_live_smoke';

// `.env.harness` від `pnpm harness:up`; явно задана змінна має пріоритет.
loadHarnessEnv(ROOT);
const adminUrl = process.env.PG_HARNESS_URL;
if (!adminUrl)
  throw new Error(
    '[live-smoke] потрібен PG_HARNESS_URL (адмін-доступ до кластера): виконай `pnpm harness:up`',
  );

// Пошта стенду (Mailpit): `SMTP_URL`/`MAIL_FROM` — лише в явний env СЕРВЕРА нижче,
// у `process.env` скрипта потрапляє тільки HTTP-API Mailpit для читання листів.
// Без нього гучна відмова (`mailpitApi`), не skip.
const mailEnv = harnessMailEnv(ROOT);
if (mailEnv.HARNESS_MAILPIT_URL)
  process.env.HARNESS_MAILPIT_URL = mailEnv.HARNESS_MAILPIT_URL;
if (!mailEnv.SMTP_URL)
  throw new Error(
    '[live-smoke] потрібен SMTP_URL (Mailpit): виконай `pnpm harness:up`',
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
  // Той самий оверлей-проба санітайзера, що й у пілоті: без неї крок `gateHttp`
  // про серверний sanitize-html червоніє (демо-сід чистий).
  await applyProbe(dbUrl);
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
    // Чиста скринька ДО старту: листи цього прогону — єдині в ній.
    await clearMailpit();
    server = await startStore(ROOT, port, {
      ...env,
      SMTP_URL: mailEnv.SMTP_URL,
      MAIL_FROM: mailEnv.MAIL_FROM,
    });
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
    browser = withClientIps(await chromium.launch());
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // Шляхи справжніх server functions (POST) — для CSRF-кроку нижче.
    const serverFnPaths = new Set();
    page.on('request', (r) => {
      const { pathname } = new URL(r.url());
      if (r.method() === 'POST' && pathname.startsWith('/_serverFn/'))
        serverFnPaths.add(pathname);
    });
    const { email } = await runFunnel({ page, base, dbUrl, check });

    // 3.1. Пошта (К3-Е8): лист замовлення, скидання пароля, підтвердження
    // реєстрації (Р30) — через справжній SMTP-канал у Mailpit.
    await runMailChecks({
      browser,
      base,
      email,
      from: mailEnv.MAIL_FROM,
      check,
    });
    await runSignupConfirmation({ browser, base, signUp, check });

    // 3a. CSRF: POST із чужим Origin на server function і server route → 403.
    await runCsrfChecks({ base, serverFnPaths, check });

    // 3a′. Р23/Р27: помилки не течуть клієнту (SSR, server function, мертва БД),
    // заголовки безпеки на всіх каналах. ПЕРЕД кроками власника: вони скидають
    // профіль/теми й не повинні впливати на лог, з якого читаємо ідентифікатори.
    await runErrorMaskChecks({
      base,
      server,
      browser,
      storeEnv: env,
      check,
    });
    await runSecurityHeaderChecks({ base, check });
    // Р25: канонічний шлях товару (301 + canonical) на справжньому сервері.
    await runProductPathChecks({ base, dbUrl, check });

    // 3б. Адмінка (Е3, Е4, Е5, Е5б, Е6а, Е6в, Е6б) — ОКРЕМИЙ context власника, та сама БД.
    const owner = { browser, buyerPage: page, base, dbUrl, storeEnv: env };
    await runOwnerSteps({ ...owner, check });

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
