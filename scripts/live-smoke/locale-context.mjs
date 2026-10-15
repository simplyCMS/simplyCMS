/**
 * Мовний контекст запиту на СПРАВЖНЬОМУ збереженому сервері (М1, Task 9).
 *
 * Чому тут, а не юнітом: юніти доводять функції (`resolveRequestLocale`,
 * `rewrite`, нормалізацію), а що Start пропускає контекст запиту до
 * `getRouter()`, що `rewrite` живе в справжньому роутері SSR і гідрації і що
 * кеш мов з поколіннями бачить нову мову БЕЗ перезапуску процесу — доводить
 * лише живий сервер. Мови додаються прямим SQL під замком `languages-set` (як
 * робить операція мов) і прибираються за собою.
 */
import { randomUUID } from 'node:crypto';
import pg from 'pg';

/** Запис у `languages` в одній транзакції під замком + підйом покоління кешу. */
async function writeLanguages(dbUrl, statements) {
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('languages-set', 0))",
    );
    for (const [text, values] of statements) await client.query(text, values);
    await client.query(
      "update public.cache_generations set generation = generation + 1 where key = 'languages'",
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

const insertLanguage = (code, name, status, sortOrder) => [
  `insert into public.languages (id, code, name, status, sort_order)
   values ($1, $2, $3, $4, $5)`,
  [randomUUID(), code, name, status, sortOrder],
];

/** GET без слідування редиректу. */
async function probe(base, path) {
  const res = await fetch(`${base}${path}`, { redirect: 'manual' });
  return {
    status: res.status,
    location: res.headers.get('location'),
    type: res.headers.get('content-type') ?? '',
    vary: res.headers.get('vary') ?? '',
    html: await res.text(),
  };
}

const htmlTag = (html) => /<html[^>]*>/.exec(html)?.[0] ?? '—';

/**
 * @param {object} p
 * @param {string} p.base `http://127.0.0.1:<port>`
 * @param {string} p.dbUrl
 * @param {import('playwright').Browser} p.browser
 * @param {(label: string, passed: boolean, fact: string) => void} p.check
 */
export async function runLocaleChecks({ base, dbUrl, browser, check }) {
  // (а) лише основна мова: корінь без префікса, нормалізація.
  const home = await probe(base, '/');
  const tag = htmlTag(home.html);
  check(
    'мова: / → <html lang="uk" dir="ltr">',
    home.status === 200 && /lang="uk"/.test(tag) && /dir="ltr"/.test(tag),
    tag,
  );
  check(
    'мова: у <head> window.__SCMS_LOCALES__ з основною мовою',
    /__SCMS_LOCALES__/.test(home.html) && /"primary":"uk"/.test(home.html),
    '__SCMS_LOCALES__ у HTML',
  );
  check(
    'мова: Accept-Language не впливає і Vary його не містить',
    !/accept-language/i.test(home.vary),
    `vary: ${home.vary || '—'}`,
  );
  for (const [from, to] of [
    ['/uk', '/'],
    ['/uk/catalog', '/catalog'],
    ['/catalog/', '/catalog'],
    ['/uk/catalog/?a=1', '/catalog?a=1'],
  ]) {
    const r = await probe(base, from);
    check(
      `мова: ${from} → рівно один 301 на ${to}`,
      r.status === 301 && r.location === to,
      `${r.status} ${r.location ?? '—'}`,
    );
  }
  // Відкритий редирект: Location завжди шлях того ж origin.
  for (const path of [
    '/uk//evil.example',
    '/uk/\\evil.example',
    '/uk/%2F%2Fevil.example',
  ]) {
    const r = await probe(base, path);
    check(
      `мова: ${path} не веде на чужий origin`,
      !r.location || /^\/(?![/\\])/.test(r.location),
      `${r.status} ${r.location ?? '—'}`,
    );
  }
  // Невітринні 404 рендеряться сторінкою магазину, а не 500 із сирими ключами.
  for (const path of ['/api/nope', '/api/v1/a/b', '/assets/nope.js']) {
    const r = await probe(base, path);
    check(
      `мова: ${path} → 404 зі сторінкою <html lang="uk"> і перекладеним текстом`,
      r.status === 404 &&
        /<html[^>]*lang="uk"/.test(r.html) &&
        /Сторінку не знайдено/.test(r.html),
      `${r.status} ${htmlTag(r.html)}`,
    );
  }
  // CSRF спрацьовує раніше за читання мов.
  const csrf = await fetch(`${base}/catalog`, {
    method: 'POST',
    headers: { origin: 'https://evil.example' },
  });
  check(
    'мова: POST /catalog із чужим Origin → 403 (CSRF до мов)',
    csrf.status === 403,
    `${csrf.status}`,
  );

  const noEn = await probe(base, '/en/catalog');
  check(
    'мова: /en/… без мови en — звичайний шлях, 404 основною мовою',
    noEn.status === 404 && /lang="uk"/.test(htmlTag(noEn.html)),
    `${noEn.status} ${htmlTag(noEn.html)}`,
  );

  // (б) друга мова: опублікована en і чернетка pl; жодного перезапуску.
  await writeLanguages(dbUrl, [
    insertLanguage('en', 'English', 'published', 10),
    insertLanguage('pl', 'Polski', 'draft', 20),
  ]);
  try {
    const en = await probe(base, '/en/catalog');
    const enTag = htmlTag(en.html);
    check(
      'мова: /en/catalog → 200 і <html lang="en" dir="ltr"> (кеш мов побачив нову мову)',
      en.status === 200 && /lang="en"/.test(enTag) && /dir="ltr"/.test(enTag),
      `${en.status} ${enTag}`,
    );
    const enRoot = await probe(base, '/en');
    check(
      'мова: /en → 200 (корінь мови без слеша)',
      enRoot.status === 200 && /lang="en"/.test(htmlTag(enRoot.html)),
      `${enRoot.status}`,
    );
    const slash = await probe(base, '/en/catalog/');
    check(
      'мова: /en/catalog/ → рівно один 301 на /en/catalog',
      slash.status === 301 && slash.location === '/en/catalog',
      `${slash.status} ${slash.location ?? '—'}`,
    );
    const primaryPrefix = await probe(base, '/uk/catalog');
    check(
      'мова: /uk/catalog при основній uk лишається 301 на /catalog',
      primaryPrefix.status === 301 && primaryPrefix.location === '/catalog',
      `${primaryPrefix.status} ${primaryPrefix.location ?? '—'}`,
    );
    const missing = await probe(base, '/en/zzz-no-such-page');
    check(
      'мова: 404 на /en/… має англійський текст і посилання на /en',
      missing.status === 404 &&
        /Page not found/.test(missing.html) &&
        /href="\/en"/.test(missing.html),
      `${missing.status}`,
    );
    for (const path of ['/en/api/health', '/en/media/x.png']) {
      const r = await probe(base, path);
      check(
        `мова: ${path} → 404 (без дубля адреси)`,
        r.status === 404,
        `${r.status}`,
      );
    }
    const draft = await probe(base, '/pl/catalog');
    check(
      'мова: /pl/catalog (чернетка) → 404 без рендеру вітрини',
      draft.status === 404 && draft.type.startsWith('text/plain'),
      `${draft.status} ${draft.type}`,
    );

    // (в) гідрація: клієнтський rewrite читає window.__SCMS_LOCALES__.
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    try {
      await page.goto(`${base}/en/catalog`, { waitUntil: 'networkidle' });
      const client = await page.evaluate(() => ({
        locales: window.__SCMS_LOCALES__,
        lang: document.documentElement.lang,
        prefixed: [...document.querySelectorAll('a[href^="/en/"]')].length,
        bare: [...document.querySelectorAll('a[href="/cart"]')].length,
      }));
      check(
        'мова: після гідрації __SCMS_LOCALES__ = { uk, [uk, en] }, lang="en"',
        client.locales?.primary === 'uk' &&
          client.locales.published.join() === 'uk,en' &&
          client.lang === 'en',
        JSON.stringify(client.locales),
      );
      check(
        'мова: посилання вітрини на /en/… мають префікс мови (rewrite output)',
        client.prefixed > 0 && client.bare === 0,
        `з префіксом ${client.prefixed}, без ${client.bare}`,
      );
      check(
        'мова: нуль pageerror на /en/catalog',
        errors.length === 0,
        errors.join('; ') || '0',
      );
    } finally {
      await page.close();
    }
  } finally {
    await writeLanguages(dbUrl, [
      ["delete from public.languages where code in ('en', 'pl')", []],
    ]);
  }
}
