/**
 * Візит кандидатної сторінки для дискаверера (інкремент Б.3, план Р4/Р5).
 * Винесено з `discover.mjs` окремим модулем, бо після двох фіксів рев'ю
 * (скрол перед пробом і власний `catch` навколо проба) функція перестала
 * бути «одним рядком поверх `page.goto`» — а канон тримає CLI тонким.
 *
 * 🔴 Провал проба НЕ провалює візит. Проб — додатковий сигнал; CSP, detached
 * frame чи таймаут `evaluate` не роблять сторінку, яка чесно віддала 2xx,
 * неіснуючою. Тому проб має власний `try/catch`, а при помилці візит
 * повертається БЕЗ поля `probe` — і `detectVisitMismatch` на відсутньому
 * пробі за контрактом віддає `false` («не міряли» ≠ «не збіглось»).
 * Без цього поділу будь-яка помилка проба перетворювалась на `visit-failed` —
 * рівно той клас «інструмент бачить не все й мовчить», проти якого весь
 * інкремент.
 */
import { scrollThrough } from './browser.mjs';

/** Типи, зміст яких верифікується пробом (Б.3, Р5) — решті сторінок вірять на слово. */
export const PROBED_TYPES = new Set(['listing', 'product']);

/**
 * @param {import('playwright').Page} page
 * @param {string} url
 * @param {string} type канонічний тип, під який кандидата перевіряють
 * @param {(...args: unknown[]) => unknown} probeFn самодостатня функція проба
 *   (серіалізується в браузер через `page.evaluate`)
 * @returns {Promise<{ ok: boolean, title?: string | null, probe?: object }>}
 */
export async function visitCandidate(page, url, type, probeFn) {
  let title;
  try {
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });
    if (!response || !response.ok()) return { ok: false };
    title = (await page.title()) || null;
  } catch {
    return { ok: false }; // мережева помилка чи таймаут переходу — сторінки немає
  }
  if (!PROBED_TYPES.has(type)) return { ok: true, title };
  try {
    // 🔴 Скрол ПЕРЕД пробом, як і на стартовій сторінці: сітку карток масово
    // дорендеровують на скролі, і знятий одразу після `goto` проб побачив би
    // нуль карток на цілком нормальному каталозі.
    await scrollThrough(page);
    // Тип їде аргументом у браузер: від нього залежить відсікання батьківської
    // сімʼї карток (лише для `product`; ревʼю Б.3, флет-каталоги для `listing`).
    return { ok: true, title, probe: await page.evaluate(probeFn, type) };
  } catch {
    return { ok: true, title };
  }
}
