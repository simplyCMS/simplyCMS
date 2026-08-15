/**
 * Семплінг computed styles сторінки + скріншоти (задача §2.A). `browserSample`
 * виконується В БРАУЗЕРІ через `page.evaluate` — самодостатня функція, без
 * замикань на модульний скоуп (Playwright серіалізує лише її toString()).
 */

/** Ліміт елементів на семпл (задача §2.A). */
export const SAMPLE_LIMIT = 2000;

/** Три контрольні viewport задачі §2.A. */
export const VIEWPORTS = { desktop: 1440, tablet: 768, mobile: 390 };

/** Виконується в браузері — свій скоуп, копії констант замість замикань. */
function browserSample(limit) {
  const shadowTopN = 5; // копія — замикання на модульний скоуп тут недоступне

  function toHex(computed) {
    const m = computed.match(
      /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/,
    );
    if (!m) return null;
    if (m[4] !== undefined && Number(m[4]) === 0) return null; // прозорий
    const hex = (n) => Math.round(Number(n)).toString(16).padStart(2, '0');
    return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
  }

  function bumpColor(map, role, value, area, interactive) {
    const key = `${role}:${value}`;
    const e = map.get(key);
    if (e) {
      e.frequency += 1;
      e.area += area;
      if (interactive) e.interactive = true;
    } else {
      map.set(key, { value, role, frequency: 1, area, interactive });
    }
  }

  // Заголовки й body-текст рахуємо окремими картами за family-ключем.
  function bumpFont(map, style) {
    const key = style.fontFamily;
    const e = map.get(key) ?? {
      family: key,
      weight: style.fontWeight,
      sizePx: parseFloat(style.fontSize),
      count: 0,
    };
    e.count += 1;
    map.set(key, e);
  }

  const colors = new Map();
  const radius = new Map();
  const shadows = new Map();
  const spacing = new Map();
  const headingFonts = new Map();
  const bodyFonts = new Map();

  const elements = [...document.querySelectorAll('body *')].slice(0, limit);

  for (const el of elements) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const area = Math.round(rect.width * rect.height);
    if (area <= 0) continue;

    const interactive =
      ['A', 'BUTTON', 'INPUT'].includes(el.tagName) ||
      el.getAttribute('role') === 'button' ||
      Boolean(el.closest('a,button,[role="button"]'));

    const bg = toHex(style.backgroundColor);
    if (bg) bumpColor(colors, 'background', bg, area, interactive);
    const fg = toHex(style.color);
    if (fg) bumpColor(colors, 'text', fg, area, interactive);
    if (parseFloat(style.borderTopWidth) > 0) {
      const border = toHex(style.borderTopColor);
      if (border) bumpColor(colors, 'border', border, area, interactive);
    }

    const radiusPx = parseFloat(style.borderTopLeftRadius);
    if (radiusPx > 0) {
      const e = radius.get(radiusPx);
      if (e) e.frequency += 1;
      else radius.set(radiusPx, { valuePx: radiusPx, frequency: 1 });
    }

    if (style.boxShadow && style.boxShadow !== 'none') {
      shadows.set(style.boxShadow, (shadows.get(style.boxShadow) ?? 0) + 1);
    }

    const marginPx = parseFloat(style.marginBottom);
    if (marginPx > 0) spacing.set(marginPx, (spacing.get(marginPx) ?? 0) + 1);

    const text = el.textContent ? el.textContent.trim() : '';
    if (/^H[1-3]$/.test(el.tagName) && text) bumpFont(headingFonts, style);
    else if (['P', 'SPAN', 'LI'].includes(el.tagName) && text)
      bumpFont(bodyFonts, style);
  }

  function topFont(map) {
    let best = null;
    for (const e of map.values()) if (!best || e.count > best.count) best = e;
    return best
      ? { family: best.family, weight: best.weight, sizePx: best.sizePx }
      : null;
  }

  const topShadows = [...shadows.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, shadowTopN)
    .map(([value]) => value);

  const fontStylesheets = [
    ...document.querySelectorAll('link[rel="stylesheet"]'),
  ].map((link) => link.href);

  return {
    colors: [...colors.values()],
    fonts: { heading: topFont(headingFonts), body: topFont(bodyFonts) },
    radius: [...radius.values()],
    shadows: topShadows,
    spacing: [...spacing.keys()].sort((a, b) => a - b),
    fontStylesheets,
  };
}

/** Семпл computed styles сторінки (Node-обгортка `page.evaluate`). */
export async function samplePalette(page) {
  return page.evaluate(browserSample, SAMPLE_LIMIT);
}

/** Full-page скріншоти на 1440/768/390 → `<outDir>/{desktop,tablet,mobile}.png`. */
export async function captureScreenshots(page, outDir) {
  const files = {
    desktop: 'desktop.png',
    tablet: 'tablet.png',
    mobile: 'mobile.png',
  };
  for (const [key, width] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: `${outDir}/${files[key]}`, fullPage: true });
  }
  return VIEWPORTS;
}
