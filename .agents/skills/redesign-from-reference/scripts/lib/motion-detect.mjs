/**
 * Детекція JS-анімаційних бібліотек і евристика «motion керується JS» (план
 * Р6, Фаза 1). ЧИСТІ функції без IO і без браузера — сирі маркери збирає
 * `browserMotionMarkers` (`browser-motion.mjs`), а тут лише зіставлення із
 * сигнатурами, тож юніти лишаються зеленими навіть без chromium.
 */

/**
 * Сигнатури бібліотек: `src` скрипта / window-глобал / імʼя `data-`атрибута.
 * 🔴 Регекси БЕЗ прапорця `g` — `RegExp.test` із `g` стежить за `lastIndex` і
 * давав би через раз false на тому самому рядку.
 */
export const SIGNATURES = [
  {
    name: 'gsap',
    src: /\bgsap\b|greensock|scrolltrigger/i,
    globals: [
      'GreenSockGlobals',
      'ScrollTrigger',
      'TweenLite',
      'TweenMax',
      'gsap',
    ],
    data: /^data-(gsap|scroll-trigger)/i,
  },
  {
    name: 'framer-motion',
    src: /framer-motion|framer\.com\/motion/i,
    globals: ['Motion', 'framerMotion'],
    data: /^data-framer/i,
  },
  {
    name: 'lottie',
    src: /lottie|bodymovin/i,
    globals: ['bodymovin', 'lottie'],
    data: /^data-(lottie|animation-path)/i,
  },
  {
    name: 'anime.js',
    src: /animejs|\banime(\.min)?\.js\b/i,
    globals: ['anime'],
    data: /^data-anime/i,
  },
];

/**
 * Кандидати window-глобалів для проби на сторінці — `motion.mjs` передає список
 * у `page.evaluate` аргументом (`browserMotionMarkers` фільтрує його по
 * `window`).
 *
 * 🔴 ВИВОДИТЬСЯ із `SIGNATURES`, а не дублює їх руками: глобал, який є в
 * сигнатурі, але випав зі списку проби, ніколи не питається у сторінки — і
 * детекція тихо сліпне на цілу бібліотеку (напр. GSAP, підключений як
 * `TweenMax` без `gsap`). Зворотне дублювання теж шкідливе: зайвий кандидат —
 * це проба, яку жодна сигнатура не вміє зіставити. Інваріант під тестом.
 */
export const MOTION_GLOBALS = [
  ...new Set(SIGNATURES.flatMap((signature) => signature.globals)),
].sort();

/**
 * Зіставити сирі маркери сторінки із сигнатурами (Р6).
 * @param {{ scriptSrcs?: string[], globals?: string[], dataAttributes?: string[] }} raw
 * @returns {{ detected: string[], markers: string[] }} обидва масиви — унікальні й відсортовані
 */
export function detectMotionLibraries(raw = {}) {
  const { scriptSrcs = [], globals = [], dataAttributes = [] } = raw;
  const detected = new Set();
  const markers = new Set();

  const hit = (name, marker) => {
    detected.add(name);
    markers.add(marker);
  };

  for (const signature of SIGNATURES) {
    for (const src of scriptSrcs) {
      if (signature.src.test(src)) hit(signature.name, `script:${src}`);
    }
    for (const global of globals) {
      if (signature.globals.includes(global))
        hit(signature.name, `global:${global}`);
    }
    for (const attribute of dataAttributes) {
      if (signature.data.test(attribute))
        hit(signature.name, `data:${attribute}`);
    }
  }

  return { detected: [...detected].sort(), markers: [...markers].sort() };
}

/**
 * CSS-властивості, поява яких у transition пояснює reveal. `all` — теж
 * пояснення: під ним ховаються і opacity, і transform.
 */
const REVEAL_PROPERTIES = new Set(['all', 'opacity', 'transform']);

/**
 * Евристика Р6: reveal на сторінці Є, а ні transitions по opacity/transform, ні
 * `@keyframes` його не пояснюють → анімацію крутить JS, і виміряних тривалостей
 * для спеки компонента не буде — автор теми має дивитись очима.
 * @param {{ reveal?: Array<{ animated?: boolean }>,
 *   transitions?: Array<{ property?: string }>,
 *   keyframes?: { names?: string[] } }} [input]
 * @returns {boolean}
 */
export function suspectJsDriven({
  reveal = [],
  transitions = [],
  keyframes = {},
} = {}) {
  if (!reveal.some((entry) => entry.animated)) return false;
  const explained =
    transitions.some((t) => REVEAL_PROPERTIES.has(t.property)) ||
    (keyframes.names?.length ?? 0) > 0;
  return !explained;
}
