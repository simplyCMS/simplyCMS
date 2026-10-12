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
  check(
    'GET /api/health',
    health.status === 200 &&
      healthJson.status === 'healthy' &&
      healthJson.checks?.database?.ok === true,
    `${health.status}, status=${healthJson.status}, database.ok=${healthJson.checks?.database?.ok}`,
  );

  return { ok, details };
}
