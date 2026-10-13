// Чисті рішення `simplycms status`: етап магазину, наступний скіл, код виходу.
// Окремо від збирання перевірок (status.mjs): ці функції без I/O, тож їх таблично
// перевіряє тест, а Task 21 додає онлайн-дані, не чіпаючи правил.

/** @typedef {'not-created' | 'local' | 'deployed'} Stage */
/** @typedef {import('./ui.mjs').Check} Check */
/** @typedef {{ skill: string; reason: string }} Next */

/**
 * Етап за слідами на диску: немає магазину → `not-created`; є магазин без запису
 * розгортання → `local`; запис `.simplycms/deploy.json` є → `deployed`.
 * @param {{ hasStoreRoot: boolean; deployJson: object | null }} input
 * @returns {Stage}
 */
export function deriveStage({ hasStoreRoot, deployJson }) {
  if (!hasStoreRoot) return 'not-created';
  return deployJson === null ? 'local' : 'deployed';
}

/**
 * Наступний рекомендований скіл. Помилки перекривають етап: несправний магазин
 * спершу діагностують. `null` — діяти нема чого.
 * @param {{ stage: Stage; checks: Check[] }} input
 * @returns {Next | null}
 */
export function nextSkill({ stage, checks }) {
  if (stage === 'not-created')
    return {
      skill: 'simplycms-onboarding',
      reason: 'магазин ще не створено — онбординг проведе від порожньої теки',
    };
  const failed = checks.filter((check) => check.status === 'error');
  if (failed.length > 0)
    return {
      skill: 'simplycms-diagnose',
      reason: `помилки перевірок: ${failed.map((check) => check.id).join(', ')}`,
    };
  if (stage === 'local')
    return {
      skill: 'simplycms-onboarding',
      reason: 'магазин працює локально — лишилось розгорнути (крок деплою)',
    };
  return null;
}

/** Код «стан невідомий»: єдиний контракт — 1 це помилка (Е8-О8), 0 і 3 зарезервовані. */
const UNKNOWN_EXIT = 1;

/**
 * 0 — все гаразд; 3 — є що робити; інше — стан невідомий. Невідоме важить більше за
 * «є що робити»: перевірка, що не відпрацювала, не дозволяє ні заспокоїти, ні радити.
 * @param {{ next: Next | null; unknown: string[] }} report
 */
export function statusExitCode({ next, unknown }) {
  if (unknown.length > 0) return UNKNOWN_EXIT;
  return next === null ? 0 : 3;
}
