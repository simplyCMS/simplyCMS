/**
 * Р23 на СПРАВЖНЬОМУ збереженому сервері: непередбачені помилки не течуть клієнту
 * (заголовки Р27 — `security-headers.mjs`).
 *
 * Чому тут, а не юнітом: SSR серіалізує помилку роуту в HTML-потік
 * (`$_TSR`-скрипт) — юніт на компонент цього не бачить, тож асертимо ВЕСЬ HTML
 * відповіді. Канали: (1) SSR `/catalog/a%00b` — NUL у slug дає помилку Postgres;
 * (2) server function по HTTP — її GET-запит береться з трафіку клієнтської
 * навігації й підміняється slug з NUL (ідентифікатори хешовані, вгадувати
 * не можна); (3) недоступна БД — окремий сервер із мертвим `DATABASE_URL`.
 * Доменні помилки з кодом (проходять НЕмасковані) доводить крок «дубль slug →
 * тост i18n» у `admin-catalog.mjs`: на masked-помилці він не знайшов би `kind`.
 */
import { join } from 'node:path';
import { startStore, freePort } from '../pilot-pack/build.mjs';

const ROOT = join(import.meta.dirname, '..', '..');

/** Фрагменти, яких у відповіді бути НЕ може (SQL, параметри, адреса БД, дефолт TanStack). */
const LEAKS = [
  /Failed query/,
  /\bselect\b/i,
  /\bparams\b/i,
  /invalid byte sequence/,
  /ECONNREFUSED/,
  /Something went wrong/,
  /Show Error/,
];

const REF = /Internal server error \[ref ([a-z0-9]{8})\]/;

/** `host:port` БД із рядка підключення — адреса, якої клієнт бачити не мусить. */
const dbAddress = (url) => new URL(url).host;

const leaked = (text, addresses) => [
  ...LEAKS.filter((re) => re.test(text)).map(String),
  ...addresses.filter((a) => text.includes(a)),
];

/** Перевіряє тіло відповіді й лог сервера: без витоку, ідентифікатор збігається. */
function checkMasked(check, label, status, body, logs, mustLog, addresses) {
  const ref = REF.exec(body)?.[1];
  const found = leaked(body, addresses);
  check(
    `${label}: у відповіді (${status}) немає тексту помилки`,
    found.length === 0 && Boolean(ref),
    found.length === 0 ? `ідентифікатор ${ref ?? '—'}` : found.join(', '),
  );
  check(
    `${label}: у лозі сервера той самий ідентифікатор і повний текст`,
    Boolean(ref) && logs.includes(ref) && mustLog.test(logs),
    ref ?? '—',
  );
}

/**
 * @param {object} p
 * @param {string} p.base `http://127.0.0.1:<port>`
 * @param {{ logs(): string }} p.server поточний сервер магазину
 * @param {import('playwright').Browser} p.browser
 * @param {Record<string, string>} p.storeEnv env сервера (для сервера з мертвою БД)
 * @param {(label: string, passed: boolean, fact: string) => void} p.check
 */
export async function runErrorMaskChecks({
  base,
  server,
  browser,
  storeEnv,
  check,
}) {
  // 1. SSR: помилка роуту серіалізується в HTML-потік.
  const ssr = await fetch(`${base}/catalog/a%00b`);
  checkMasked(
    check,
    'Р23 SSR /catalog/a%00b',
    ssr.status,
    await ssr.text(),
    server.logs(),
    /Failed query/,
    [dbAddress(storeEnv.DATABASE_URL)],
  );

  // 2. Server function по HTTP: реальний GET із клієнтської навігації, slug → NUL.
  const page = await browser.newPage();
  const seen = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (r.method() === 'GET' && url.pathname.startsWith('/_serverFn/'))
      seen.push(url);
  });
  await page.goto(`${base}/catalog`);
  const href = await page
    .locator('a[href^="/catalog/"]')
    .first()
    .getAttribute('href');
  seen.length = 0;
  await page.locator('a[href^="/catalog/"]').first().click();
  await page.waitForLoadState('networkidle');
  await page.close();
  const slug = href?.split('/').pop() ?? '';
  const call = seen.find((u) => u.searchParams.get('payload')?.includes(slug));
  check(
    'Р23: у трафіку навігації є GET server function зі slug',
    Boolean(call),
    href ?? '—',
  );
  if (call) {
    const payload = call.searchParams
      .get('payload')
      .replaceAll(`"${slug}"`, '"a\\u0000b"');
    call.searchParams.set('payload', payload);
    const res = await fetch(call, { headers: { 'x-tsr-serverFn': 'true' } });
    checkMasked(
      check,
      'Р23 server function по HTTP',
      res.status,
      await res.text(),
      server.logs(),
      /invalid byte sequence/,
      [dbAddress(storeEnv.DATABASE_URL)],
    );
  }

  // 3. Недоступна БД: у відповіді немає ECONNREFUSED і host:port.
  const deadPort = await freePort();
  const port = await freePort();
  const dead = await startStore(ROOT, port, {
    ...storeEnv,
    DATABASE_URL: `postgres://app:pw@127.0.0.1:${deadPort}/none`,
    BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
    VITE_SITE_URL: `http://127.0.0.1:${port}`,
  });
  try {
    const res = await fetch(`http://127.0.0.1:${port}/catalog`);
    checkMasked(
      check,
      'Р23 SSR, БД недоступна',
      res.status,
      await res.text(),
      dead.logs(),
      /ECONNREFUSED/,
      [`127.0.0.1:${deadPort}`],
    );
  } finally {
    dead.stop();
  }
}
