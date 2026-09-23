import type { MessageKey } from 'simplycms/i18n';

/**
 * Ключ повідомлення для конфлікту БД (Е3-7). Розрізняємо за полями, а не
 * `instanceof`: seroval десеріалізує помилку serverFn у голий `Error` з
 * накладеними властивостями (К3-13). Клас `AdminConflictError` живе в
 * server-only дереві — сюди він не імпортується навіть типом.
 */
type ConflictShape = {
  name?: unknown;
  kind?: unknown;
  constraint?: unknown;
  cause?: unknown;
};

/** Скільки рівнів `.cause` розгортати — коло, не нескінченний цикл. */
const MAX_CAUSE_DEPTH = 5;

/**
 * Знаходить перший рівень (сам обʼєкт або якийсь `.cause` під ним), що несе
 * `name === 'AdminConflictError'`: через TanStack DB транзакцію помилка
 * теоретично може дійти обгорнутою в `.cause`; основний захист —
 * `normalizeThrown` (handlers.ts), тримає genuine Error ДО @tanstack/db,
 * це друга лінія.
 * UPSTREAM:TSDB-5 — docs/architecture/upstream-workarounds.md
 */
function unwrapConflict(error: unknown): ConflictShape | null {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth++) {
    const e = current as ConflictShape;
    if (e.name === 'AdminConflictError') return e;
    current = e.cause;
  }
  return null;
}

export function adminErrorKey(error: unknown): MessageKey | null {
  const e = unwrapConflict(error);
  if (!e) return null;
  if (e.kind === 'reference') return 'admin.errors.conflictReference';
  // Входження, не суфікс: product_modifications_product_slug_unique названо
  // руками, решта slug-обмежень — *_slug_key (аудит 2026-09-23).
  return typeof e.constraint === 'string' && e.constraint.includes('slug')
    ? 'admin.errors.slugTaken'
    : 'admin.errors.conflictUnique';
}
