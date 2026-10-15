/**
 * Gate B — production + server fns.
 *
 * Скретч підіймається своїм `server.mjs` (той самий node-runner, що й у
 * магазині кінцевого користувача) і відповідає на живі curl-и. Це доводить,
 * що `createServerFn` із пакета працює в PRODUCTION-манифесті, а не лише
 * у dev-режимі монорепо.
 *
 * 🔴 Очікувані назви беруться з тієї самої бази, з якою працює магазин, —
 * прямим SQL за `DATABASE_URL`. HTTP-API до БД у контракті v2 немає взагалі
 * (PostgREST зник у 0.4.1), тож іншого способу дізнатися, ЩО має
 * опинитися в HTML, не існує. База довільна, тому достатньо, щоб у HTML
 * знайшлася хоч одна назва: більшого про чужі дані сказати не можна.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { get } from 'node:http';
import pg from 'pg';

/** Товари з БД — очікувані рядки для SSR-перевірок. */
export async function expectedProducts(env) {
  const client = new pg.Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    // 🔴 Читаємо ТІЄЮ САМОЮ дорогою, що й магазин. `DATABASE_URL` за
    // контрактом 0.4.1 логіниться роллю `app_runtime`, у якої прямих грантів
    // НЕМАЄ за побудовою (`0000_prelude.sql` — `noinherit`; `0002_grants.sql`
    // — жодного табличного гранта). Голий `select` тут падав із
    // `permission denied for table products` рівно тоді, коли розробник
    // дотримався власного контракту, — тобто гейт карав за ПРАВИЛЬНИЙ конфіг,
    // а зеленів на привілейованому DSN. Форма преамбули — та сама, що в
    // `withActor` (`simplycms/db`) і в тестовій копії контракту
    // `test-harness/pg/actors.mjs`.
    await client.query('begin');
    await client.query('set local role app_user');
    const { rows } = await client.query(
      'select name from public.products where is_active = true limit 50',
    );
    await client.query('commit');
    // Імена зі спецсимволами HTML пропускаємо — React їх екранує.
    return rows
      .map((row) => row.name)
      .filter((name) => typeof name === 'string' && !/[&<>"']/.test(name));
  } finally {
    await client.end();
  }
}

/**
 * Чи знайшлася в HTML хоч одна очікувана назва.
 *
 * @param {string} html
 * @param {string[]} names
 */
function matchNames(html, names) {
  const hit = names.find((name) => html.includes(name));
  return { passed: Boolean(hit), fact: `назва товару: ${hit ?? '—'}` };
}

/**
 * @param {number} port
 * @param {Record<string,string>} env
 * @returns {Promise<{ ok: boolean; details: string[] }>}
 */
export async function gateHttp(port, env) {
  const base = `http://127.0.0.1:${port}`;
  const names = await expectedProducts(env);
  const details = [];
  let ok = true;

  /** Одна перевірка: фіксуємо ФАКТИЧНИЙ результат, не лише вердикт. */
  const check = (label, passed, fact) => {
    details.push(`${passed ? 'OK  ' : 'FAIL'} ${label} — ${fact}`);
    if (!passed) ok = false;
  };

  const home = await fetch(`${base}/`);
  const homeMatch = matchNames(await home.text(), names);
  check(
    'GET /',
    home.status === 200 && homeMatch.passed,
    `${home.status}, ${homeMatch.fact}`,
  );

  const catalog = await fetch(`${base}/catalog`);
  const catalogHtml = await catalog.text();
  const catalogMatch = matchNames(catalogHtml, names);
  const hasPrice = catalogHtml.includes('₴');
  check(
    'GET /catalog',
    catalog.status === 200 && catalogMatch.passed && hasPrice,
    `${catalog.status}, ${catalogMatch.fact}, ціни(₴): ${hasPrice}`,
  );

  // 🔴 Рантайм-сторож санітайзера на СЕРВЕРНОМУ бандлі скретча (UPSTREAM:START-IP-1): у бандл
  // вклеєні dual-пакети (`is-plain-object`, `postcss`, `nanoid`), яких `sanitize-html` бере через
  // `require()` — безпечно лише поки він бере іменовані експорти. Статичний Gate SB переходу на
  // default-імпорт не бачить, тож тут реально проганяємо `sanitize-html` на SSR: опис товару з
  // оверлею — rich-розмітка зі `style` (проганяє `postcss.parse`), `<script>` і `onerror`. Проба — оверлей пілота `sanitize-probe.sql`
  // (`apply-probe.mjs` поверх `pnpm db:demo`; демо-сід чистий): без неї крок червоніє, а не мовчки пропускається.
  const probe = await fetch(
    `${base}/catalog/invertory/invertor-merezhevyi-5kw`,
  );
  const probeHtml = await probe.text();
  const kept =
    probeHtml.includes('<strong>98%</strong>') &&
    probeHtml.includes('<a href="https://example.com/inverter"') &&
    /<p style="text-align:\s*center">/.test(probeHtml);
  const dirty =
    /<script>alert\(1\)|onerror=/.test(probeHtml) ||
    probeHtml.includes('title="t"') ||
    probeHtml.includes('color:red') ||
    probeHtml.includes('color: red');
  check(
    'GET /catalog/invertory/invertor-merezhevyi-5kw (sanitize-html на сервері)',
    probe.status === 200 && kept && !dirty,
    `${probe.status}, <strong>/<a href> лишились: ${kept}, небезпечне лишилось: ${dirty}` +
      (probe.status === 200 && !kept
        ? ' (або немає проби — `node scripts/pilot-pack/apply-probe.mjs <DSN>` поверх `pnpm db:demo`, або серверний sanitize-html зламаний)'
        : ''),
  );

  const admin = await fetch(`${base}/admin`, { redirect: 'manual' });
  const location = admin.headers.get('location');
  check(
    'GET /admin (guard)',
    admin.status >= 300 && admin.status < 400 && location === '/auth',
    `${admin.status} → ${location ?? '—'}`,
  );

  // Сторінка встановлення пароля з invite-флоу: гарда «залогінених геть»
  // тут навмисно немає, тож анонімний GET мусить віддати 200. Якщо роут не
  // приїхав із tarball-а `@simplycms/storefront-routes` — буде 404.
  const setPassword = await fetch(`${base}/auth/set-password`);
  check(
    'GET /auth/set-password',
    setPassword.status === 200,
    `${setPassword.status}`,
  );

  const sitemap = await fetch(`${base}/sitemap.xml`);
  const sitemapBody = await sitemap.text();
  check(
    'GET /sitemap.xml',
    sitemap.status === 200 && sitemapBody.includes('<urlset'),
    `${sitemap.status}, ${sitemap.headers.get('content-type')}, url-ів: ${
      sitemapBody.split('<url>').length - 1
    }`,
  );

  const robots = await fetch(`${base}/robots.txt`);
  const robotsBody = await robots.text();
  check(
    'GET /robots.txt',
    robots.status === 200 && robotsBody.includes('Sitemap:'),
    `${robots.status}, ${robots.headers.get('content-type')}`,
  );

  const health = await fetch(`${base}/api/health`);
  const healthJson = await health.json();
  // 🔴 `build` доводить, що `define` __SIMPLYCMS_BUILD_ID__ з vite.config магазину
  // дійшов до коду ЯДРА в node_modules (а не лише до коду самого магазину):
  // без нього там лишився б guard-дефолт 'dev'. Очікуване значення пілот задає
  // сам перед збіркою (`BUILD_ID=e8-…`); у `--reuse` збірка стара, тож
  // вимагаємо хоча б «не dev».
  const expectedBuild = process.env.BUILD_ID?.slice(0, 12);
  const buildOk = expectedBuild
    ? healthJson.build === expectedBuild
    : typeof healthJson.build === 'string' && healthJson.build !== 'dev';
  check(
    'GET /api/health',
    health.status === 200 &&
      healthJson.status === 'healthy' &&
      healthJson.checks?.database?.ok === true &&
      buildOk,
    `${health.status}, status=${healthJson.status}, database.ok=${healthJson.checks?.database?.ok}, build=${healthJson.build} (очікую ${expectedBuild ?? 'не dev'})`,
  );

  // Стиснення статики (Task 7): `server.mjs` лише ВІДДАЄ `.br`/`.gz` через
  // sirv, а кладе їх плагін `precompressAssets` у збірці. Без нього вимір
  // показував нуль. Заголовок `Accept-Encoding` ставимо сирим `http.get`:
  // `fetch` додає свій і не дає перевірити «без заголовка».
  const entry = /\/assets\/[^"']+\.js/.exec(
    await (await fetch(`${base}/`)).text(),
  )?.[0];
  const brHead = entry ? await headOf(port, entry, 'br') : null;
  const plainHead = entry ? await headOf(port, entry, null) : null;
  check(
    'GET /assets/<entry>.js (стиснення)',
    brHead?.['content-encoding'] === 'br' &&
      plainHead !== null &&
      plainHead['content-encoding'] === undefined,
    `${entry ?? 'entry не знайдено в HTML'}: br → ${brHead?.['content-encoding'] ?? '—'}, без заголовка → ${plainHead?.['content-encoding'] ?? '—'}`,
  );

  return { ok, details };
}

/** Заголовки відповіді на GET зі вказаним (або без) `Accept-Encoding`. */
function headOf(port, path, acceptEncoding) {
  return new Promise((resolveHead, reject) => {
    const request = get(
      {
        host: '127.0.0.1',
        port,
        path,
        headers: acceptEncoding ? { 'accept-encoding': acceptEncoding } : {},
      },
      (response) => {
        response.resume();
        resolveHead(response.headers);
      },
    );
    request.on('error', reject);
  });
}

/**
 * Доказ, що `scripts/start.mjs` справді замінив процес (Е8-Р6): PID той самий
 * (`execve` міняє образ, не процес), `cmdline` — вже `server.mjs`, а в
 * `environ` немає пароля власника схеми. Лише Linux (`/proc`); на інших ОС —
 * явний skip із причиною, а не мовчазний «зелений».
 *
 * @param {number} pid PID дитини, якого запустив гейт
 * @param {string} startLogs лог старту (накат мусить сказати, що нічого не робить)
 * @param {{ smtp?: boolean }} [opts] `smtp` — прогін задав SMTP (К3-Е8): попередження про лог не очікується
 * @returns {{ ok: boolean; skipped?: boolean; details: string[] }}
 */
export function checkExecve(pid, startLogs, { smtp = false } = {}) {
  const details = [];
  let ok = true;
  const check = (label, passed, fact) => {
    details.push(`${passed ? 'OK  ' : 'FAIL'} ${label} — ${fact}`);
    if (!passed) ok = false;
  };

  check(
    'лог старту',
    startLogs.includes('нічого накочувати'),
    'очікую «нічого накочувати» (БД уже накочена db:demo)',
  );
  // Р7′ п.3: log-драйвер у проді — попередження рівно ОДИН раз (друкує лише бандл).
  // З SMTP (повний прогін `pilot-full`) драйвер smtp, і попередження не має бути.
  const warnings = startLogs.split('пошта не налаштована').length - 1;
  const expected = smtp ? 0 : 1;
  check(
    smtp
      ? 'без попередження про пошту (SMTP задано)'
      : 'попередження про пошту',
    warnings === expected,
    `разів: ${warnings}`,
  );
  if (process.platform !== 'linux') {
    details.push(
      `SKIP /proc/<pid>/environ і cmdline — перевірка лише на Linux (тут ${process.platform})`,
    );
    return { ok, skipped: true, details };
  }
  const environ = readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0');
  check(
    'environ без MIGRATION_DATABASE_URL',
    !environ.some((entry) => entry.startsWith('MIGRATION_DATABASE_URL=')),
    `${environ.length} змінних`,
  );
  const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0');
  check(
    'cmdline — server.mjs',
    cmdline.some((arg) => arg.endsWith('server.mjs')),
    cmdline.join(' ').trim(),
  );
  return { ok, details };
}

/**
 * Перевірка env у ЗІБРАНОМУ бандлі (Е8-Р7′): виклик у `src/server.ts` мусить
 * пережити збірку, і часткова група S3 валить `server.mjs` ДО listen. Окремий
 * процес зі штучним порожнім портом: слухання довело б, що перевірка не спрацювала.
 *
 * @param {string} storeDir
 * @param {Record<string,string>} env env скретча (три ключі + групи драйверів, якщо задані)
 */
export function checkPartialEnv(storeDir, env) {
  const secret = 'pilot-partial-bucket-value';
  // Повний прогін несе всю групу S3 (К3-Е8) у `.env` скретча, а `server.mjs`
  // наповнює з нього ВІДСУТНІ ключі. Порожній рядок — «присутній, але порожній»:
  // і блокує наповнення, і читається групою як відсутній, тож лишається
  // тільки `S3_BUCKET` — інакше група була б повною, і перевірка нічого б не довела.
  const emptyS3 = Object.fromEntries(
    ['S3_ENDPOINT', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'].map((k) => [
      k,
      '',
    ]),
  );
  const run = spawnSync('node', ['server.mjs'], {
    cwd: storeDir,
    env: {
      ...process.env,
      ...env,
      ...emptyS3,
      S3_BUCKET: secret,
      PORT: '0',
      HOST: '127.0.0.1',
    },
    encoding: 'utf8',
    timeout: 30_000,
  });
  const out = `${run.stdout}${run.stderr}`;
  const passed =
    run.status !== null &&
    run.status !== 0 &&
    out.includes('S3_ENDPOINT') &&
    !out.includes(secret) &&
    !out.includes('слухає');
  return {
    ok: passed,
    details: [
      `${passed ? 'OK  ' : 'FAIL'} часткова група S3 у зібраному бандлі — код ${run.status}, ` +
        `називає S3_ENDPOINT: ${out.includes('S3_ENDPOINT')}, слухав: ${out.includes('слухає')}`,
    ],
  };
}
