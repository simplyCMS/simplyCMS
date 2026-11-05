import { collectConsoleErrors } from './head-console.mjs';

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
