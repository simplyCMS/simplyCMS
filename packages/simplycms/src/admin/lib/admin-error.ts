import type { MessageKey } from 'simplycms/i18n';
import { DOMAIN_ERROR_NAME } from 'simplycms/contracts/domain-errors';

/**
 * Ключ повідомлення для конфлікту БД (Е3-7). Розрізняємо за полями, а не
 * `instanceof`: клас `AdminConflictError` живе в server-only дереві —
 * сюди він не імпортується навіть типом, лише `DOMAIN_ERROR_NAME`
 * (T0, `contracts/domain-errors`).
 *
 * 🔴 Без розгортання `.cause` (Е3-20, закрито): до `domainErrorAdapter`
 * помилка мала б розгортатись, бо `@tanstack/db`'s `commit()` нібито
 * замінював ПЛОСКИЙ (не-`Error`) обʼєкт на голий `Error(String(x))`.
 * Корінь був у серіалізації Start (ShallowErrorPlugin губив поля, але
 * ЛИШАВ `instanceof Error`) — адаптер тепер повертає `Error` з полями НА
 * ВЕРХНЬОМУ рівні, і транзакція `@tanstack/db` (`error instanceof Error ?
 * error : …`) їх більше не чіпає. Доказ —
 * `__tests__/conflict-through-transaction.test.ts` (реальна колекція/
 * транзакція, не ручний `Object.assign`). Реєстр TSDB-5
 * (docs/architecture/upstream-workarounds.md) закритий.
 */
type ConflictShape = {
  name?: unknown;
  kind?: unknown;
  constraint?: unknown;
};

/** Повідомлення саме мережевого фейлу `fetch` у трьох основних рушіях. */
const NETWORK_MESSAGE = /failed to fetch|networkerror|load failed/i;

/**
 * Мережевий фейл `fetch` — голий `TypeError` без спеціалізованого повідомлення
 * (наприклад «x is not a function») мережею НЕ вважається: він не відрізняє
 * розрив звʼязку від багу виклику. Офлайн (`navigator.onLine === false`) —
 * окрема, самодостатня ознака: браузер гарантовано не достукається до
 * сервера незалежно від тексту помилки.
 */
function isNetworkError(error: unknown): boolean {
  const e = error as { name?: unknown; message?: unknown } | null | undefined;
  const isTypeError = error instanceof TypeError || e?.name === 'TypeError';
  const messageMatches =
    typeof e?.message === 'string' && NETWORK_MESSAGE.test(e.message);
  const offline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  return (isTypeError && messageMatches) || offline;
}

export function adminErrorKey(error: unknown): MessageKey | null {
  const e = error as ConflictShape | null | undefined;
  if (e?.name === DOMAIN_ERROR_NAME.adminConflict) {
    if (e.kind === 'reference') return 'admin.errors.conflictReference';
    // Входження, не суфікс: product_modifications_product_slug_unique названо
    // руками, решта slug-обмежень — *_slug_key (аудит 2026-09-23).
    return typeof e.constraint === 'string' && e.constraint.includes('slug')
      ? 'admin.errors.slugTaken'
      : 'admin.errors.conflictUnique';
  }
  if (isNetworkError(error)) return 'admin.errors.network';
  return null;
}
