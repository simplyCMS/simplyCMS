// Правило query сторінки сутності після кроку історії адрес (майстер §3.2): ОДНЕ для серверної
// нормалізації (`seo/history.ts`, 301) і клієнтської навігації (`entity-route.ts`, редирект).
// Модуль клієнтобезпечний: `seo/` — server-only, а клієнтський лоадер мусить мати те саме правило.

const isPrimitive = (v: unknown): boolean =>
  typeof v === 'string' ||
  typeof v === 'number' ||
  typeof v === 'boolean' ||
  v === null;

/**
 * Токен `?mod=` рядком або `null`. Роутер JSON-розбирає query, і `?mod=5`/`true`/`null` для нього
 * не рядки (див. `entitySearch`); не примітив (масив, об'єкт) токеном не є.
 */
export function tokenOf(query: Record<string, unknown>): string | null {
  return isPrimitive(query.mod) ? String(query.mod) : null;
}

/**
 * Query кінцевої адреси: решта параметрів — як є; історичний токен — поточним (`current`), інакше
 * сирий токен рядком; не примітив — геть. `mod` — завжди рядок (як його бачить `entitySearch`):
 * токен з цифр тоді серіалізується лапкованою формою, яку роутер вважає канонічною, і другого
 * (307) редіректу немає.
 */
export function queryAfterHistory(
  query: Record<string, unknown>,
  current: string | null,
): Record<string, unknown> {
  const mod = tokenOf(query);
  const next = { ...query };
  if (current !== null) next.mod = current;
  else if (mod !== null) next.mod = mod;
  else delete next.mod;
  return next;
}
