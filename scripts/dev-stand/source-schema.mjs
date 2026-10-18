/**
 * Перевірка схеми ДЖЕРЕЛА дампу стенда до першого читання (фінальне рев'ю М1, C-I1).
 *
 * Дампер читає таблиці М1 (переклади, фото, реєстри адрес і токенів) і фільтрує мову
 * підзапитом до `languages`. БД до мультимовності цих таблиць не має, а сирий
 * `relation "product_translations" does not exist` не каже власнику, що робити. Режиму
 * читання легасі-схеми свідомо НЕМАЄ (до пілоту — жодних шляхів оновлення старих БД,
 * AGENTS.md): таку БД перестворюють, а не мігрують дампом.
 */

import { TABLE_SPECS } from './table-specs.mjs';

/** Усі таблиці, які читає дамп: allowlist + `languages` (фільтр основної мови). */
export const REQUIRED_TABLES = [
  ...new Set(['languages', ...TABLE_SPECS.map((spec) => spec.table)]),
];

/** Таблиці з `REQUIRED_TABLES`, яких у `public` джерела немає. */
export async function missingSourceTables(client) {
  const { rows } = await client.query(
    `select t as name from unnest($1::text[]) t
      where to_regclass('public.' || quote_ident(t)) is null
      order by t`,
    [REQUIRED_TABLES],
  );
  return rows.map((row) => row.name);
}

/** Зрозуміла відмова замість сирого «relation does not exist». */
export function preM1SchemaError(missing) {
  return new Error(
    `схема джерела до М1 — немає таблиць: ${missing.join(', ')}.
Дамп знімається лише з БД зі схемою мультимовності М1. БД до мультимовності не мігрується
дампом: перестворити її й наповнити (\`pnpm db:showcase\`), а свої дані внести вручну.
Див. scripts/dev-stand/README.md.`,
  );
}

export async function assertSourceSchema(client) {
  const missing = await missingSourceTables(client);
  if (missing.length > 0) throw preM1SchemaError(missing);
}
