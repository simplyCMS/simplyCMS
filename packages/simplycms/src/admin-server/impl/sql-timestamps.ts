import { sql, type SQL } from 'drizzle-orm';

/**
 * `db.execute` віддає `timestamptz` рядком у форматі Postgres, який `Date`
 * розбирає ненадійно (мікросекунди, зсув `+00`). Тож у сирому SQL колонка
 * вибирається ISO-рядком у UTC, а `toDate` робить із нього `Date` (мс).
 */
export const isoTs = (column: SQL): SQL =>
  sql`to_char(${column} at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export const toDate = (value: string): Date => new Date(value);
export const toDateOrNull = (value: string | null): Date | null =>
  value === null ? null : new Date(value);
