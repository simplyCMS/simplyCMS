/**
 * Снапшот reveal-стану секцій, що виконується В БРАУЗЕРІ (план Р4, Фаза 1).
 * Окремий модуль (а не доважок до `browser-motion.mjs`) — бо це окремий канал:
 * його знімають ДВІЧІ, до і після першого скрол-проходу, а різницю рахує вже
 * Node (`diffReveal` у `motion.mjs`). Функція САМОДОСТАТНЯ: Playwright
 * серіалізує лише `toString()`, замикань на модульний скоуп тут бути не може.
 */

/**
 * Знімок `opacity`/`transform` секцій верхнього рівня. Корінь — `main`
 * (сучасна розмітка), fallback — `body > section` (референси без `main`).
 * `selector` беруть із ПЕРШОГО знімка: клас-маркер розкриття
 * (`.is-visible`/`.revealed`) додається саме тим, що ми міряємо, тож після
 * скролу той самий вузол мав би інший рядок і пари «до/після» не зійшлись би.
 */
export function browserRevealSnapshot() {
  const root = document.querySelector('main');
  const nodes = root
    ? [...root.children]
    : [...document.querySelectorAll('body > section')];

  return nodes.map((el, index) => {
    const style = getComputedStyle(el);
    const classes =
      typeof el.className === 'string' && el.className.trim()
        ? `.${el.className.trim().split(/\s+/).join('.')}`
        : '';
    const tag = el.tagName.toLowerCase();
    const opacity = parseFloat(style.opacity);

    return {
      index,
      tag,
      selector: `${tag}${el.id ? `#${el.id}` : ''}${classes}`,
      opacity: Number.isFinite(opacity) ? opacity : 1,
      transform: style.transform,
    };
  });
}
