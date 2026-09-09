// DOM для `theme:conformance` поза тестовим рушієм. Доктрина репо: важкий
// тулчейн не їде в кожен магазин — jsdom ставиться on-demand за гучною
// інструкцією (та сама модель, що Playwright у `inspect.mjs` скіла редизайну).
import { importFromStore } from './theme-conformance-env.mjs';

/** Точна команда донавантаження — друкується, а не обходиться мовчки. */
export const JSDOM_HINT = 'pnpm add -D jsdom';

/**
 * Публікація jsdom-DOM у глобальний контекст процесу. Копіюємо лише те, чого
 * в Node немає, а невелику форсовану групу перезаписуємо: `navigator` у Node
 * є свій, і без підміни react-dom бачив би два різні світи.
 * @param {{ document: unknown }} window
 */
function exposeDom(window) {
  for (const key of Object.getOwnPropertyNames(window)) {
    if (key in globalThis) continue;
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get: () => window[key],
    });
  }
  const forced = {
    window,
    self: window,
    document: window.document,
    navigator: window.navigator,
    location: window.location,
    history: window.history,
    getComputedStyle: window.getComputedStyle.bind(window),
  };
  for (const [key, value] of Object.entries(forced)) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
}

/**
 * DOM для conformance: jsdom вантажиться ДИНАМІЧНО і його відсутність — не
 * мовчазний fallback, а падіння з точною командою установки.
 * @param {string} storeRoot
 */
export async function installStoreDom(storeRoot) {
  let JSDOM;
  try {
    ({ JSDOM } = await importFromStore(storeRoot, 'jsdom'));
  } catch (cause) {
    throw new Error(
      'Для theme:conformance потрібне DOM-середовище, а пакета jsdom у ' +
        `магазині немає. Постав його разово:\n  ${JSDOM_HINT}`,
      { cause },
    );
  }
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  exposeDom(dom.window);
  return dom;
}
