/**
 * Функції hover-sweep, що виконуються В БРАУЗЕРІ (план Р5, Фаза 2). Окремий
 * модуль за тим самим правилом, що `browser-motion.mjs`/`browser-reveal.mjs`:
 * Playwright серіалізує в сторінковий контекст лише `toString()` функції, тож
 * кожна має бути САМОДОСТАТНЬОЮ — жодних замикань на модульний скоуп
 * (константи копіюються всередину). Node-обгортка — `hover-sweep.mjs`.
 */

/**
 * Метадані одного кандидата на ховер: стабільний селектор, ознака видимості й
 * computed-значення цікавих властивостей. Викликається ДВІЧІ на елемент — до
 * і після `hover()`; селектор беруть із ПЕРШОГО виклику: ховер цілком може
 * додати вузлу клас, і другий рядок був би вже інший.
 * @param {Element} el
 * @param {string[]} properties
 */
export function browserHoverMeta(el, properties) {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const classes =
    typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).join('.')}`
      : '';
  const tag = el.tagName.toLowerCase();

  const styles = {};
  for (const property of properties)
    styles[property] = style.getPropertyValue(property);

  return {
    selector: `${tag}${el.id ? `#${el.id}` : ''}${classes}`,
    // `display:none` дає нульовий rect, а от `visibility:hidden` — ні: вузол
    // лишається в потоці й має розміри. Тому площі самої недостатньо.
    visible:
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden',
    styles,
  };
}

/**
 * Точка viewport-а, під якою немає нічого, крім `body`/`html` — туди
 * відводиться курсор ПІСЛЯ проходу. 🔴 Без цього останній зависклий ховер
 * протік би у фінальний семпл палітри: `samplePalette` читає computed styles,
 * а `:hover` — це теж computed style, і колір однієї кнопки поїхав би в
 * пропозицію токенів як «колір сайту». Кандидати перебираються у фіксованому
 * порядку, тож точка детермінована; якщо вільної немає (full-bleed лейаут) —
 * правий нижній піксель як чесний фолбек.
 */
export function browserNeutralPoint() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const candidates = [
    [width - 2, height - 2],
    [2, height - 2],
    [width - 2, 2],
    [Math.floor(width / 2), height - 2],
  ];

  for (const [x, y] of candidates) {
    const el = document.elementFromPoint(x, y);
    if (!el || el === document.body || el === document.documentElement)
      return { x, y };
  }
  return { x: width - 2, y: height - 2 };
}
