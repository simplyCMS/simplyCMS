/**
 * Функції motion-капчера, що виконуються В БРАУЗЕРІ (план Р1, Фаза 1).
 * Виокремлено в окремий модуль, бо `browser-sample.mjs` уже рівно на межі
 * канону (150 рядків), а кожна така функція має бути САМОДОСТАТНЬОЮ: Playwright
 * серіалізує лише її `toString()` у сторінковий контекст, тож замикання на
 * модульний скоуп дало б `ReferenceError` (звідси копії констант усередині).
 * Node-обгортка й чиста детекція — `motion.mjs` / `motion-detect.mjs`.
 */

/**
 * Кластери CSS-transition сторінки (Р1): `{ property, durationMs, easing,
 * count }`. Обхід — ті самі `body *` і той самий ліміт, що в семплері палітри.
 */
export function browserTransitions(limit) {
  // Розбиття CSS-списку верхнього рівня: кома ВСЕРЕДИНІ дужок
  // (`cubic-bezier(0.4, 0, 0.2, 1)`) — не роздільник, наївний `split(',')`
  // рвав би easing на чотири «значення» і зсував пари property↔duration.
  const splitTop = (value) => {
    const parts = [];
    let depth = 0;
    let current = '';
    for (const ch of value ?? '') {
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      if (ch === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else current += ch;
    }
    parts.push(current.trim());
    return parts.filter((part) => part.length > 0);
  };

  const toMs = (raw) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.round(String(raw).trim().endsWith('ms') ? n : n * 1000);
  };

  const clusters = new Map();
  const elements = [...document.querySelectorAll('body *')].slice(0, limit);

  for (const el of elements) {
    const style = getComputedStyle(el);
    const properties = splitTop(style.transitionProperty);
    if (properties.length === 0) continue;
    const durations = splitTop(style.transitionDuration);
    const easings = splitTop(style.transitionTimingFunction);

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      if (property === 'none') continue;
      // CSS-списки можуть бути різної довжини — добір циклічний, рівно як це
      // робить сам движок при обчисленні transition-шорткату.
      const durationMs = durations.length
        ? toMs(durations[i % durations.length])
        : 0;
      if (durationMs <= 0) continue;
      const easing = easings.length ? easings[i % easings.length] : 'ease';

      const key = `${property}|${durationMs}|${easing}`;
      const existing = clusters.get(key);
      if (existing) existing.count += 1;
      else clusters.set(key, { property, durationMs, easing, count: 1 });
    }
  }

  // Повний детермінований ключ сортування (не лише count): інакше два кластери
  // з однаковою частотою міняли б місця між прогонами.
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return [...clusters.values()].sort(
    (a, b) =>
      b.count - a.count ||
      cmp(a.property, b.property) ||
      a.durationMs - b.durationMs ||
      cmp(a.easing, b.easing),
  );
}

/**
 * Імена `@keyframes` документа + ЧЕСНИЙ лічильник недоступних аркушів (Р1):
 * cross-origin stylesheet кидає `SecurityError` на `.cssRules`, і мовчазний
 * дроп приховав би від автора теми цілий пласт анімацій.
 */
export function browserKeyframes() {
  const KEYFRAMES_RULE = 7; // CSSRule.KEYFRAMES_RULE — копія, не замикання
  const names = new Set();
  let inaccessibleSheets = 0;

  // Рекурсія — бо `@keyframes` цілком легально живе всередині `@media`/
  // `@supports`, і плаский обхід верхнього рівня їх не побачив би.
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.type === KEYFRAMES_RULE && rule.name) names.add(rule.name);
      else if (rule.cssRules) {
        try {
          walk(rule.cssRules);
        } catch {
          inaccessibleSheets += 1;
        }
      }
    }
  };

  for (const sheet of document.styleSheets) {
    let rules = null;
    try {
      rules = sheet.cssRules;
    } catch {
      rules = null;
    }
    if (!rules) {
      inaccessibleSheets += 1;
      continue;
    }
    walk(rules);
  }

  return { names: [...names].sort(), inaccessibleSheets };
}

/**
 * СИРІ маркери JS-анімацій зі сторінки (Р6): `src` скриптів, наявні
 * window-глобали з переданого списку кандидатів і імена `data-*`-атрибутів.
 * Сама детекція — чиста функція `motion-detect.mjs` (юніти без браузера).
 */
export function browserMotionMarkers({ globalNames, limit }) {
  const scriptSrcs = new Set();
  for (const script of document.querySelectorAll('script[src]')) {
    if (script.src) scriptSrcs.add(script.src);
  }

  const dataAttributes = new Set();
  for (const el of [...document.querySelectorAll('body *')].slice(0, limit)) {
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-')) dataAttributes.add(attr.name);
    }
  }

  return {
    scriptSrcs: [...scriptSrcs].sort(),
    globals: globalNames.filter((name) => name in window).sort(),
    dataAttributes: [...dataAttributes].sort(),
  };
}
