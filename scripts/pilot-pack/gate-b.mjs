/**
 * Gate B — production + server fns.
 *
 * Скретч підіймається своїм `server.mjs` (той самий node-runner, що й у
 * магазині кінцевого користувача) і відповідає на живі curl-и. Це доводить,
 * що `createServerFn` із пакета працює в PRODUCTION-манифесті, а не лише
 * у dev-режимі монорепо.
 *
 * 🔴 Два режими очікувань:
 *  - проти ДОВІЛЬНОЇ бази (`pnpm pilot`) — назви беруться з живої БД, і
 *    достатньо, щоб у HTML знайшлася хоч одна: більшого про чужі дані сказати
 *    не можна;
 *  - на СІДІ (`pnpm pilot:e2e`) — очікування точні: у HTML мають бути ВСІ
 *    товари з `seed-fixtures.mjs`. Тільки так гейт ловить регресію рендера,
 *    а не коливання даних.
 */

/** Товари з БД — очікувані рядки для SSR-перевірок довільної бази. */
export async function expectedProducts(env) {
  const url = `${env.VITE_SUPABASE_URL}/rest/v1/products?select=name&is_active=eq.true&limit=50`;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(url, { headers: { apikey: key } });
  if (!res.ok)
    throw new Error(`Gate B: REST-запит товарів впав (${res.status})`);
  // Імена зі спецсимволами HTML пропускаємо — React їх екранує.
  return (await res.json())
    .map((row) => row.name)
    .filter((name) => typeof name === 'string' && !/[&<>"']/.test(name));
}

/**
 * Чи знайшлися очікувані назви в HTML.
 *
 * @param {string} html
 * @param {string[]} names
 * @param {boolean} exact точний режим — потрібні ВСІ назви, а не хоча б одна
 */
function matchNames(html, names, exact) {
  if (!exact) {
    const hit = names.find((name) => html.includes(name));
    return { passed: Boolean(hit), fact: `назва товару: ${hit ?? '—'}` };
  }
  const missing = names.filter((name) => !html.includes(name));
  return {
    passed: names.length > 0 && missing.length === 0,
    fact: `товарів сіду ${names.length - missing.length}/${names.length}${
      missing.length > 0 ? `, немає: ${missing.join(', ')}` : ''
    }`,
  };
}

/**
 * @param {number} port
 * @param {Record<string,string>} env
 * @param {{ expectedNames?: string[] | null }} [opts] точні очікування сіду
 * @returns {Promise<{ ok: boolean; details: string[] }>}
 */
export async function gateHttp(port, env, { expectedNames = null } = {}) {
  const base = `http://127.0.0.1:${port}`;
  const exact = Array.isArray(expectedNames);
  const names = exact ? expectedNames : await expectedProducts(env);
  const details = [];
  let ok = true;

  /** Одна перевірка: фіксуємо ФАКТИЧНИЙ результат, не лише вердикт. */
  const check = (label, passed, fact) => {
    details.push(`${passed ? 'OK  ' : 'FAIL'} ${label} — ${fact}`);
    if (!passed) ok = false;
  };

  const home = await fetch(`${base}/`);
  const homeMatch = matchNames(await home.text(), names, exact);
  check(
    'GET /',
    home.status === 200 && homeMatch.passed,
    `${home.status}, ${homeMatch.fact}`,
  );

  const catalog = await fetch(`${base}/catalog`);
  const catalogHtml = await catalog.text();
  const catalogMatch = matchNames(catalogHtml, names, exact);
  const hasPrice = catalogHtml.includes('₴');
  check(
    'GET /catalog',
    catalog.status === 200 && catalogMatch.passed && hasPrice,
    `${catalog.status}, ${catalogMatch.fact}, ціни(₴): ${hasPrice}`,
  );

  const admin = await fetch(`${base}/admin`, { redirect: 'manual' });
  const location = admin.headers.get('location');
  check(
    'GET /admin (guard)',
    admin.status >= 300 && admin.status < 400 && location === '/auth',
    `${admin.status} → ${location ?? '—'}`,
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
    health.status === 200 && healthJson.status === 'healthy',
    `${health.status}, status=${healthJson.status}`,
  );

  return { ok, details };
}
