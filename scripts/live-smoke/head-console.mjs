/**
 * Доказ асинхронного `head()` і прогріву каталогу на справжньому браузері (М2а, Task 4).
 *
 * Юніти доводять функції; що `<title>` із SSR не розходиться з `document.title` після
 * гідрації, що клієнтський перехід ставить перекладений заголовок, а гідрація не
 * лишає в консолі помилок суспенду чи mismatch, — доводить лише живий браузер.
 */

/**
 * Дозволені повідомлення консолі `error` на сторінках воронки. Порожній список: кожен
 * рядок тут мусить мати причину, а перевірку не вимикають.
 */
const ALLOWED_CONSOLE_ERRORS = [
  // Імітація проксі (`client-ip.mjs`) додає `x-forwarded-for` до КОЖНОГО запиту контексту,
  // зокрема до шрифтів теми на fonts.gstatic.com: їхній preflight цей заголовок не дозволяє.
  // Артефакт харнеса, не дефект вітрини (у проді браузер такого заголовка не шле).
  /Access to font at 'https:\/\/fonts\.gstatic\.com\/.*x-forwarded-for/,
  // Парний рядок Chromium до попереднього блокування CORS: без URL, лише код.
  /^Failed to load resource: net::ERR_FAILED$/,
];

/**
 * Збирач `console.error` сторінки; `stop()` знімає слухачів (далі `page` робить інше).
 *
 * `TypeError: Failed to fetch` не в allow-list: це наслідок `page.goto` посеред живого
 * server-fn запиту (Chromium обриває його як `net::ERR_ABORTED`), тож він дозволений РІВНО
 * стільки разів, скільки було перерваних fetch/xhr-запитів, — решта лишається дефектом.
 */
export function collectConsoleErrors(page) {
  const errors = [];
  const abortedFetches = { count: 0 };
  const onConsole = (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (ALLOWED_CONSOLE_ERRORS.some((rx) => rx.test(text))) return;
    errors.push(`[${page.url()}] ${text}`);
  };
  const onRequestFailed = (request) => {
    const kind = request.resourceType();
    if (
      (kind === 'fetch' || kind === 'xhr') &&
      request.failure()?.errorText === 'net::ERR_ABORTED'
    )
      abortedFetches.count += 1;
  };
  page.on('console', onConsole);
  page.on('requestfailed', onRequestFailed);
  return {
    errors,
    stop: () => {
      page.off('console', onConsole);
      page.off('requestfailed', onRequestFailed);
      let budget = abortedFetches.count;
      return errors.filter(
        (e) => !(/TypeError: Failed to fetch/.test(e) && budget-- > 0),
      );
    },
  };
}

/** `<title>` SSR-відповіді тієї ж адреси: сирий HTML, розібраний DOMParser у сторінці. */
const ssrTitle = (page, path) =>
  page.evaluate(async (url) => {
    const html = await (await fetch(url)).text();
    return new DOMParser().parseFromString(html, 'text/html').title;
  }, path);

/**
 * (а) SSR-`<title>` = `document.title` після гідрації (`networkidle`) на сторінці товару
 * й каталогу; (б) каталог має ПЕРЕКЛАДЕНИЙ заголовок (не сирий ключ `catalog.title`);
 * (в) клієнтський перехід головна → каталог теж дає перекладений заголовок.
 */
export async function runHeadTitleChecks({ page, base, productSlug, check }) {
  for (const path of [`/${productSlug}`, '/catalog']) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const server = await ssrTitle(page, path);
    const client = await page.title();
    check(
      `title ${path}: SSR = після гідрації`,
      server !== '' && server === client,
      `SSR «${server}», клієнт «${client}»`,
    );
  }
  const catalog = await page.title();
  check(
    'title /catalog перекладений каталогом, а не сирий ключ',
    catalog.startsWith('Каталог'),
    catalog,
  );

  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.locator('a[href="/catalog"]').first().click();
  const moved = await page
    .waitForFunction(() => document.title.startsWith('Каталог'), null, {
      timeout: 10_000,
    })
    .then(() => true)
    .catch(() => false);
  check(
    'title після клієнтського переходу / → /catalog',
    moved,
    await page.title(),
  );
}

/**
 * Маркер ідентичності вузлів SSR-DOM: на `readystatechange` зі станом `interactive` (до
 * виконання модульних скриптів, тобто до гідрації) ставимо властивість на `main` і на
 * `body.firstElementChild`. Після `networkidle` вона на місці ⇒ гідрація НЕ перемалювала
 * SSR (React при відкаті на клієнтський рендер замінює вузли). Це єдиний спосіб побачити
 * призупинення кореня на гідрації: у прод-збірці воно не лишає ні помилки, ні попередження.
 */
const MARK_SCRIPT = () => {
  document.addEventListener('readystatechange', () => {
    if (document.readyState !== 'interactive') return;
    const mark = Math.random().toString(36).slice(2);
    window.__ssrMark = mark;
    for (const el of [
      document.querySelector('main'),
      document.body.firstElementChild,
    ])
      if (el) el.__ssrMark = mark;
  });
};

/** Текст, схожий на сирий ключ каталогу (`ns.part.key`), серед видимих вузлів. */
const RAW_KEY = /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9]+){1,}$/;

export async function runHydrationIdentityChecks({
  browser,
  base,
  productSlug,
  check,
}) {
  const page = await browser.newPage();
  await page.addInitScript(MARK_SCRIPT);
  const collected = collectConsoleErrors(page);
  for (const path of ['/', `/${productSlug}`]) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const facts = await page.evaluate((rx) => {
      const mark = window.__ssrMark;
      const els = [
        document.querySelector('main'),
        document.body.firstElementChild,
      ].filter(Boolean);
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      );
      const raw = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.nodeValue.trim();
        if (new RegExp(rx).test(text)) raw.push(text);
      }
      return {
        marked:
          Boolean(mark) &&
          els.length > 0 &&
          els.every((e) => e.__ssrMark === mark),
        raw,
      };
    }, RAW_KEY.source);
    check(
      `гідрація ${path}: SSR-вузли ті самі (маркер)`,
      facts.marked,
      facts.marked ? 'вузли збережено' : 'вузли замінено клієнтським рендером',
    );
    check(
      `гідрація ${path}: сирих ключів у тексті немає`,
      facts.raw.length === 0,
      facts.raw.join(', ') || '0',
    );
  }
  const unexpected = collected.stop();
  check(
    'гідрація `/` і товар: console.error',
    unexpected.length === 0,
    unexpected.join(' | ') || '0',
  );
  await page.close();
}
