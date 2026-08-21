/**
 * Функція семплінгу computed styles, що виконується В БРАУЗЕРІ (задача §2.A).
 * Виокремлено з `sample.mjs` (Р2/канон ≤150 рядків): Playwright серіалізує
 * лише `toString()` цієї функції в сторінковий контекст, тож вона
 * САМОДОСТАТНЯ — жодних замикань на модульний скоуп (звідси копії констант
 * замість імпортів). Node-обгортка (`samplePalette`, sanity-фільтр радіуса)
 * лишається в `sample.mjs`.
 */

/** Виконується в браузері — свій скоуп, копії констант замість замикань. */
export function browserSample(limit) {
  const shadowTopN = 5; // копія — замикання на модульний скоуп тут недоступне

  // Нормалізація CSS-кольору в `#rrggbb` КОЛІРНИМ РУШІЄМ БРАУЗЕРА, не
  // регуляркою. 🔴 Регекс `rgba?()` мовчки губив КОЖЕН сучасний запис: Chrome
  // віддає computed `color`/`background-color` у вихідному просторі —
  // `lab()`, `oklab()`, `oklch()`, `color(display-p3 …)`, — а Tailwind v4
  // (яким зроблено і сам SimplyCMS) генерує саме такі. На живому референсі це
  // давало 5 кольорів замість справжньої палітри: домінантний текст
  // `lab(2.75381 0 0)` (n=233, area 44.6M) зникав, «найчастішим» ставав білий
  // n=19 — пропозиція виходила з foreground == background (контраст 1.00:1).
  // Растеризація 1×1 віддає sRGB-байти, якими сторінка й малюється. Валідність
  // — подвійний сентинел: невалідний рядок лишає `fillStyle` попереднім.
  const toHex = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const cache = new Map(); // значення повторюються сотні разів — міряємо раз
    const byte = (n) => n.toString(16).padStart(2, '0');
    return (computed) => {
      if (!computed || !ctx) return null;
      if (cache.has(computed)) return cache.get(computed);
      ctx.fillStyle = '#000000';
      ctx.fillStyle = computed;
      const fromBlack = ctx.fillStyle;
      ctx.fillStyle = '#ffffff';
      ctx.fillStyle = computed;
      let hex = null;
      if (fromBlack === ctx.fillStyle) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        if (a !== 0) hex = `#${byte(r)}${byte(g)}${byte(b)}`; // прозорий → null
      }
      cache.set(computed, hex);
      return hex;
    };
  })();

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

  const colors = new Map();
  const radius = new Map();
  const shadows = new Map();
  const spacing = new Map();

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
  }

  const topShadows = [...shadows.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, shadowTopN)
    .map(([value]) => value);

  const fontStylesheets = [
    ...document.querySelectorAll('link[rel="stylesheet"]'),
  ].map((link) => link.href);

  // `fonts` тут навмисно НЕМАЄ: голосування за сімʼї — окремий evaluate
  // (`browser-fonts.mjs`, Р7), результати зшиває Node-обгортка `samplePalette`.
  return {
    colors: [...colors.values()],
    radius: [...radius.values()],
    shadows: topShadows,
    spacing: [...spacing.keys()].sort((a, b) => a - b),
    fontStylesheets,
  };
}
