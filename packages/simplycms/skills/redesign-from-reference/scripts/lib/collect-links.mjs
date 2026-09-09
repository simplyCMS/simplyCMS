/**
 * Збір лінків із уже завантаженої й прокрученої сторінки (задача §2.C.1,
 * план Р4/Р3b): усі `a[href]` з DOM НЕЗАЛЕЖНО від видимості — бургер-меню з
 * `display:none` теж має href-и в DOM (Р4). Тексти якоря агрегуються тут-таки,
 * у браузерному контексті (textContent + aria-label + title + img[alt]
 * усередині лінка) — Р3b, іконковий кошик без видимого тексту читається саме
 * звідси; `classifyLinks` (Фаза 2) далі агрегує ці тексти по нормалізованому
 * pathname з УСІХ входжень лінка на сторінці.
 */

/** Ліміт кількості лінків у виводі (Р4) — запобіжник для сторінок з тисячами href. */
export const LINKS_LIMIT = 200;

/**
 * @param {import('@playwright/test').Page} page Уже завантажена й прокручена
 *   (`scrollThrough`) сторінка.
 * @returns {Promise<Array<{ url: string, anchors: string[] }>>}
 */
export async function collectLinks(page) {
  const raw = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]')).map((a) => {
      const imgAlts = Array.from(a.querySelectorAll('img[alt]')).map(
        (img) => img.getAttribute('alt') || '',
      );
      const texts = [
        a.textContent || '',
        a.getAttribute('aria-label') || '',
        a.getAttribute('title') || '',
        ...imgAlts,
      ]
        .map((t) => t.trim())
        .filter(Boolean);
      // `a.href` (НЕ getAttribute) — браузер сам резолвить відносний href у
      // абсолютний URL відносно поточного document.baseURI.
      return { href: a.href, texts };
    });
  });

  // Origin — з фактичного URL сторінки (після можливих редиректів), не з
  // вхідного startUrl: same-origin фільтр має звірятись із тим, де ми
  // реально опинились.
  const origin = new URL(page.url()).origin;
  const links = [];
  for (const { href, texts } of raw) {
    if (links.length >= LINKS_LIMIT) break;
    let parsed;
    try {
      parsed = new URL(href);
    } catch {
      continue; // `javascript:`/биті href — не URL
    }
    if (parsed.origin !== origin) continue;
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    links.push({ url: parsed.href, anchors: texts });
  }
  return links;
}
