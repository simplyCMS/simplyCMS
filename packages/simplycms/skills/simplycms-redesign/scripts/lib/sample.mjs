/**
 * Node-обгортка семплінгу computed styles + скріншоти (задача §2.A). Сама
 * функція, що виконується В БРАУЗЕРІ через `page.evaluate` —
 * `browser-sample.mjs` (самодостатня, без замикань на цей модуль:
 * Playwright серіалізує лише її `toString()`).
 */
import { browserFonts } from './browser-fonts.mjs';
import { browserSample } from './browser-sample.mjs';
import { scrollThrough } from './browser.mjs';

/** Ліміт елементів на семпл (задача §2.A). */
export const SAMPLE_LIMIT = 2000;

/** Три контрольні viewport задачі §2.A. */
export const VIEWPORTS = { desktop: 1440, tablet: 768, mobile: 390 };

/** Висота контрольного viewport — спільна для скріншотів і семплу (Р1b). */
export const VIEWPORT_HEIGHT = 900;

/**
 * Sanity-межа радіуса, px (план Р2). Карткові/кнопкові радіуси — ≤48px;
 * усе понад цю межу — pill/full (Tailwind `rounded-full` →
 * `calc(infinity*1px)` → computed `33554400px`). Фільтр — ТУТ, у Node-
 * обгортці `samplePalette`, а НЕ всередині `browserSample`: та функція
 * серіалізується в сторінковий контекст, і модульна константа там дала б
 * `ReferenceError`.
 */
export const RADIUS_SANITY_MAX = 64;

/**
 * Семпл computed styles сторінки (Node-обгортка `page.evaluate`). Радіус-
 * кластери понад `RADIUS_SANITY_MAX` — відкидаються тут (Р2), а не в
 * `browserSample`; `radiusDropped` — чесна лічильна ознака для `inspection.json`.
 *
 * Шрифт-сімʼї знімає ОКРЕМИЙ evaluate (`browserFonts`, Р7): вага сімʼї —
 * сума довжин тексту, і власний обхід текстових вузлів у `browserSample`
 * уже не вміщався в канонні 150 рядків. Обидва проходи бачать той самий
 * лейаут (виклик один, viewport між ними не змінюється).
 */
export async function samplePalette(page) {
  const sample = await page.evaluate(browserSample, SAMPLE_LIMIT);
  const fonts = await page.evaluate(browserFonts, SAMPLE_LIMIT);
  const radius = sample.radius.filter((r) => r.valuePx <= RADIUS_SANITY_MAX);
  const radiusDropped = sample.radius.length - radius.length;
  return { ...sample, fonts, radius, radiusDropped };
}

/**
 * Full-page скріншоти на 1440/768/390 → `<outDir>/{desktop,tablet,mobile}.png`.
 * Перед КОЖНИМ знімком — `scrollThrough` (Р1): ліниві секції, видимі лише на
 * якомусь одному з трьох viewport-ів (mobile/tablet-only лейаути), інакше
 * лишаються нерозкритими саме там.
 */
export async function captureScreenshots(page, outDir) {
  const files = {
    desktop: 'desktop.png',
    tablet: 'tablet.png',
    mobile: 'mobile.png',
  };
  for (const [key, width] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await scrollThrough(page);
    await page.screenshot({ path: `${outDir}/${files[key]}`, fullPage: true });
  }
  return VIEWPORTS;
}
