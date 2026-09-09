/**
 * Снапшот reveal-стану секцій, що виконується В БРАУЗЕРІ (план Р4 Фази 1
 * інкремента Б.2; корінь-кандидати — Р6 інкремента Б.3). Окремий модуль (а не
 * доважок до `browser-motion.mjs`) — бо це окремий канал: його знімають ДВІЧІ,
 * до і після першого скрол-проходу, а різницю рахує вже Node (`diffReveal` у
 * `motion.mjs`). Функція САМОДОСТАТНЯ: Playwright серіалізує лише `toString()`,
 * замикань на модульний скоуп тут бути не може — тому і стеля вибірки, і
 * список ігнорованих тегів живуть УСЕРЕДИНІ неї.
 */

/**
 * Знімок `opacity`/`transform` секцій сторінки.
 *
 * Корінь — діти `main` (сучасна розмітка). Якщо `main` немає, беремо
 * `body > section` ПЛЮС дітей обгорток верхнього рівня: на референсі прогону
 * №2 секції лежали рівно на цей ярус глибше, плаский `body > section` давав
 * НУЛЬ вузлів, і канал мовчав замість міряти (V-5; контрольний дослід — 0 → 3).
 * Глибше не спускаємось: reveal — секційний канал, а не обхід усього DOM.
 *
 * `selector` беруть із ПЕРШОГО знімка: клас-маркер розкриття
 * (`.is-visible`/`.revealed`) додається саме тим, що ми міряємо, тож після
 * скролу той самий вузол мав би інший рядок і пари «до/після» не зійшлись би.
 *
 * @returns {{ root: 'main' | 'body-fallback', nodes: Array<{ index: number,
 *   tag: string, selector: string, opacity: number, transform: string }> }}
 */
export function browserRevealSnapshot() {
  // Стеля вибірки: кожен вузол — це `getComputedStyle` двічі за інспекцію плюс
  // серіалізація в Node, а fallback-ярус на обгортко-важкій розмітці легко дає
  // сотні кандидатів. 60 із запасом покриває секційний каркас реальної
  // сторінки. 🔴 Інлайн, а не модульна константа: замикання не серіалізується.
  const MAX_NODES = 60;
  // Невізуальні теги: `getComputedStyle` для них безглуздий, а в fallback-ярусі
  // вони трапляються (інлайн-`<script>` між секціями — звичайна справа).
  const SKIP_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'];

  const main = document.querySelector('main');
  const candidates = [];
  if (main) {
    candidates.push(...main.children);
  } else {
    for (const child of document.body.children) {
      // Секція верхнього рівня — сама кандидат; будь-що інше вважаємо
      // обгорткою і беремо її дітей. DOM-порядок зберігається самою
      // послідовністю обходу, без сортування.
      if (child.tagName === 'SECTION') candidates.push(child);
      else candidates.push(...child.children);
    }
  }

  const seen = new Set();
  const nodes = [];
  for (const el of candidates) {
    if (nodes.length >= MAX_NODES) break;
    if (SKIP_TAGS.includes(el.tagName) || seen.has(el)) continue;
    seen.add(el);

    const style = getComputedStyle(el);
    const classes =
      typeof el.className === 'string' && el.className.trim()
        ? `.${el.className.trim().split(/\s+/).join('.')}`
        : '';
    const tag = el.tagName.toLowerCase();
    const opacity = parseFloat(style.opacity);

    nodes.push({
      // Індекс — позиція у ВИБІРЦІ (не в DOM): саме за ним `diffReveal` зводить
      // пари «до/після», і обидва знімки будують його однаково.
      index: nodes.length,
      tag,
      selector: `${tag}${el.id ? `#${el.id}` : ''}${classes}`,
      opacity: Number.isFinite(opacity) ? opacity : 1,
      transform: style.transform,
    });
  }

  return { root: main ? 'main' : 'body-fallback', nodes };
}
