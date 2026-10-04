import { getTableColumns, type Column, type Table } from 'drizzle-orm';

/**
 * Е5-7: проєкція SELECT/RETURNING — усі колонки таблиці, крім `omit`.
 * Чиста функція: ключі — TS-імена колонок (як у `db.select()` без
 * аргументу), тож рядки результату мають ту саму форму, лише без прихованих.
 */
export function pickColumns(
  table: Table,
  omit: readonly string[],
): Record<string, Column> {
  const hidden = new Set(omit);
  return Object.fromEntries(
    Object.entries(getTableColumns(table)).filter(([k]) => !hidden.has(k)),
  );
}

/**
 * Е5-12: ефективний ліміт сторінки `list` —
 * `min(subset.limit ?? maxLimit, maxLimit)`. Без серверної межі
 * (`maxLimit === undefined`) — ліміт subset як є (може бути `undefined`).
 */
export function effectiveLimit(
  subsetLimit: number | undefined,
  maxLimit: number | undefined,
): number | undefined {
  return maxLimit === undefined
    ? subsetLimit
    : Math.min(subsetLimit ?? maxLimit, maxLimit);
}

/**
 * Е5б Task 8: `maxLimit` — лише додатне ціле. Перевіряється на старті
 * фабрики (fail-loud при імпорті модуля ресурсу), а не на першому запиті:
 * `LIMIT 0`/дробовий/`NaN` мовчки ламали б сторінку або SQL.
 */
export function assertMaxLimit(entity: string, maxLimit: number | undefined) {
  if (maxLimit === undefined) return;
  if (!Number.isInteger(maxLimit) || maxLimit <= 0)
    throw new Error(
      `[admin-server] ${entity}: maxLimit має бути додатним цілим, отримано ${String(maxLimit)}`,
    );
}
