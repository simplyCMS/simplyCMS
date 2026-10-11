/**
 * Помічники очікування умови для браузерних кроків живого прогону.
 *
 * 🔴 Чому: інтерфейс сходиться асинхронно (мутація → інвалідація → рендер), а
 * `locator.count()`/`isVisible()` читають DOM ОДРАЗУ — на повільнішому прогоні
 * вони дають хибний «нуль»/«невидимий». Так вийшов флейк Е6д «доставка:
 * setDefault» (миттєвий `count()` + нестрогий вибір рядка). Тут умова чекається
 * з коротким таймаутом (ретраї самого Playwright), а не паузою, і результат —
 * `boolean`, щоб крок записав FAIL у таблицю замість винятку посеред сценарію.
 * Заборона миттєвих читань — `tests/live-smoke-no-instant-checks.test.ts`.
 */
import { expect } from '@playwright/test';

/** Чекає, поки елемент стане видимим; `true`/`false`, не кидає. */
export async function expectVisible(locator, timeout = 5_000) {
  return expect(locator)
    .toBeVisible({ timeout })
    .then(() => true)
    .catch(() => false);
}

/** Чекає, поки елемента не стане (або він сховається); `true`/`false`. */
export async function expectGone(locator, timeout = 5_000) {
  return expect(locator)
    .toBeHidden({ timeout })
    .then(() => true)
    .catch(() => false);
}

/** Чекає, поки кількість збігів стане рівно `n`; `true`/`false`. */
export async function expectCount(locator, n, timeout = 5_000) {
  return expect(locator)
    .toHaveCount(n, { timeout })
    .then(() => true)
    .catch(() => false);
}

/** Чекає, поки збігів стане щонайменше один (на відміну від `expectCount`, не рівність). */
export async function expectSome(locator, timeout = 5_000) {
  return expect(locator.first())
    .toBeAttached({ timeout })
    .then(() => true)
    .catch(() => false);
}

/** Чекає, поки елемент стане disabled; `true`/`false`, не кидає. */
export async function expectDisabled(locator, timeout = 5_000) {
  return expect(locator)
    .toBeDisabled({ timeout })
    .then(() => true)
    .catch(() => false);
}
