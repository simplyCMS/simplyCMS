/**
 * Node-обгортка motion-капчера (план Р1/Р4/Р5/Р6): збирає секцію `motion`
 * для `inspection.json` із пʼяти каналів — transitions, keyframes, reveal,
 * hover, jsLibraries. Функції, що виконуються в браузері, — `browser-motion.mjs`
 * і `browser-reveal.mjs`; чиста детекція бібліотек — `motion-detect.mjs`;
 * ховер-прохід — `hover-sweep.mjs` (Фаза 2).
 */
import {
  browserKeyframes,
  browserMotionMarkers,
  browserTransitions,
} from './browser-motion.mjs';
import { browserRevealSnapshot } from './browser-reveal.mjs';
import { scrollThrough } from './browser.mjs';
import {
  detectMotionLibraries,
  MOTION_GLOBALS,
  suspectJsDriven,
} from './motion-detect.mjs';
import { SAMPLE_LIMIT } from './sample.mjs';

/** Поріг «секція реально проявилась» за дельтою opacity (Р4). */
export const REVEAL_OPACITY_DELTA = 0.2;

/**
 * @typedef {{ index: number, tag: string, selector: string, opacity: number,
 *   transform: string }} RevealSnapshotEntry
 * @typedef {{ index: number, tag: string, selector: string,
 *   opacityBefore: number, opacityAfter: number, transformChanged: boolean,
 *   animated: boolean }} RevealDiffEntry
 */

/**
 * Різниця двох reveal-знімків (чиста функція — юніти без браузера). Пари
 * зводяться за `index`, метадані (`tag`/`selector`) беруться зі знімка ДО:
 * після розкриття класи вузла інші, і «після» дав би нестабільний ключ.
 * @param {RevealSnapshotEntry[]} before
 * @param {RevealSnapshotEntry[]} after
 * @returns {RevealDiffEntry[]}
 */
export function diffReveal(before, after) {
  const afterByIndex = new Map(after.map((entry) => [entry.index, entry]));

  return before
    .map((from) => {
      const to = afterByIndex.get(from.index) ?? from;
      const transformChanged = to.transform !== from.transform;
      const opacityDelta = Math.abs(to.opacity - from.opacity);
      return {
        index: from.index,
        tag: from.tag,
        selector: from.selector,
        opacityBefore: from.opacity,
        opacityAfter: to.opacity,
        transformChanged,
        animated: opacityDelta >= REVEAL_OPACITY_DELTA || transformChanged,
      };
    })
    .sort((a, b) => a.index - b.index);
}

/**
 * Зняти reveal-дельту (Р4).
 *
 * 🔴 Викликати ЛИШЕ на свіжозавантаженій сторінці й ДО будь-якого іншого
 * скролу: `scrollThrough` за одну інспекцію відпрацьовує щонайменше пʼять
 * разів (тричі всередині `captureScreenshots` + під light- і dark-семпли), а
 * reveal-once секція після першого проходу лишається розкритою назавжди —
 * у другому проході дельта opacity/transform тотожно нульова.
 */
export async function captureReveal(page) {
  const before = await page.evaluate(browserRevealSnapshot);
  await scrollThrough(page);
  const after = await page.evaluate(browserRevealSnapshot);
  return diffReveal(before, after);
}

/**
 * Зібрати секцію `motion` для `inspection.json`. `reveal` і `hover` приходять
 * ззовні з тієї самої причини — обидва звʼязані порядком кроків інспекції, і
 * зняти їх тут, наприкінці, було б уже пізно (див. коментар до `captureReveal`
 * і шапку `hover-sweep.mjs`).
 * @param {import('@playwright/test').Page} page
 * @param {{ reveal: Array<object>, hover: object }} captured
 * @returns {Promise<{
 *   transitions: Array<{ property: string, durationMs: number, easing: string, count: number }>,
 *   keyframes: { names: string[], inaccessibleSheets: number },
 *   reveal: Array<object>,
 *   hover: { entries: Array<object>, skipped: number },
 *   jsLibraries: { detected: string[], markers: string[] },
 *   jsDrivenSuspected: boolean,
 * }>}
 */
export async function captureMotion(page, { reveal, hover }) {
  const transitions = await page.evaluate(browserTransitions, SAMPLE_LIMIT);
  const keyframes = await page.evaluate(browserKeyframes);
  const markers = await page.evaluate(browserMotionMarkers, {
    globalNames: MOTION_GLOBALS,
    limit: SAMPLE_LIMIT,
  });

  return {
    transitions,
    keyframes,
    reveal,
    hover,
    jsLibraries: detectMotionLibraries(markers),
    jsDrivenSuspected: suspectJsDriven({ reveal, transitions, keyframes }),
  };
}
