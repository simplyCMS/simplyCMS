import type { MessageKey } from 'simplycms/i18n';

/**
 * Ключ повідомлення для конфлікту БД (Е3-7). Розрізняємо за полями, а не
 * `instanceof`: seroval десеріалізує помилку serverFn у голий `Error` з
 * накладеними властивостями (К3-13). Клас `AdminConflictError` живе в
 * server-only дереві — сюди він не імпортується навіть типом.
 */
export function adminErrorKey(error: unknown): MessageKey | null {
  const e = error as {
    name?: unknown;
    kind?: unknown;
    constraint?: unknown;
  } | null;
  if (e?.name !== 'AdminConflictError') return null;
  if (e.kind === 'reference') return 'admin.errors.conflictReference';
  // Входження, не суфікс: product_modifications_product_slug_unique названо
  // руками, решта slug-обмежень — *_slug_key (аудит 2026-09-23).
  return typeof e.constraint === 'string' && e.constraint.includes('slug')
    ? 'admin.errors.slugTaken'
    : 'admin.errors.conflictUnique';
}
