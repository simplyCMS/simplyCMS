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

/**
 * Таймаут очікування → `false`; усе інше (strict mode violation на неоднозначному
 * локаторі, невалідний селектор) кидається.
 *
 * 🔴 Чому: колись `.catch(() => false)` ковтав усе. Radix Toast за кадр-два після
 * тосту додає прихований a11y-анонс з тим самим текстом; `getByText(текст тосту)`
 * тоді давав strict mode violation, а помилка маскувалась під «не видно» — флейк
 * Р30 (~50%). Неоднозначність локатора — дефект кроку, його видно одразу, а не
 * ховають у «false».
 */
function timeoutOrThrow(e) {
  if (/^Timeout: \d+ms$/m.test(String(e?.message))) return false;
  throw e;
}

/**
 * Локатор тосту: текст ЛИШЕ в регіоні сповіщень Radix (`role="region"`,
 * `aria-label="Notifications (F8)"`). a11y-анонс Radix (`role="status"`, visually
 * hidden) портується в `body` поза регіоном, тож не збігається. `.first()` — на
 * випадок кількох тостів із однаковим текстом поспіль.
 */
export function toastText(page, text) {
  return page
    .getByRole('region', { name: /Notifications/ })
    .getByText(text)
    .first();
}

/** Чекає видимий тост із текстом; `true`/`false` (таймаут), помилка локатора кидається. */
export function waitToast(page, text, timeout = 10_000) {
  return expectVisible(toastText(page, text), timeout);
}

/** Чекає, поки елемент стане видимим; `false` лише за таймаутом, неоднозначний локатор кидається. */
export async function expectVisible(locator, timeout = 5_000) {
  return expect(locator)
    .toBeVisible({ timeout })
    .then(() => true)
    .catch(timeoutOrThrow);
}

/** Чекає, поки елемента не стане (або він сховається); `false` лише за таймаутом. */
export async function expectGone(locator, timeout = 5_000) {
  return expect(locator)
    .toBeHidden({ timeout })
    .then(() => true)
    .catch(timeoutOrThrow);
}

/** Чекає, поки кількість збігів стане рівно `n`; `true`/`false`. */
export async function expectCount(locator, n, timeout = 5_000) {
  return expect(locator)
    .toHaveCount(n, { timeout })
    .then(() => true)
    .catch(timeoutOrThrow);
}

/** Чекає, поки збігів стане щонайменше один (на відміну від `expectCount`, не рівність). */
export async function expectSome(locator, timeout = 5_000) {
  return expect(locator.first())
    .toBeAttached({ timeout })
    .then(() => true)
    .catch(timeoutOrThrow);
}

/** Чекає, поки елемент стане disabled; `true`/`false`, не кидає. */
export async function expectDisabled(locator, timeout = 5_000) {
  return expect(locator)
    .toBeDisabled({ timeout })
    .then(() => true)
    .catch(timeoutOrThrow);
}
