/**
 * Генерація ідемпотентного `seed-demo.sql` із санітизованого каталожного
 * дампу (план Р8, Step 3).
 *
 * 🔴 Чистий модуль: на вхід — `{ tableName: rows[] }`, на вихід — рядок SQL.
 * Жодного IO і жодного `pg` — саме тому він і покритий тестом на фікстурі
 * (`tests/dev-stand-seed.test.ts`), а дампер лишається тонким.
 *
 * Ідемпотентність: кожен блок — один `insert ... on conflict (id) do update
 * set ...`. Чому арбітр саме `id`, а не природний ключ, — `table-specs.mjs`.
 */

import {
  allColumns,
  findSpec,
  TABLE_SPECS,
  updateColumns,
} from './table-specs.mjs';
import { toSqlLiteral } from './sql-literal.mjs';

const HEADER = `-- ЗГЕНЕРОВАНО: node scripts/dev-stand/dump-demo-data.mjs — РУКАМИ НЕ ПРАВИТИ.
-- Demo-датасет діагностичного стенда: ЛИШЕ каталог (секції, товари,
-- властивості, ціни). Персональних даних тут немає за побудовою — allowlist
-- таблиць і колонок живе в scripts/dev-stand/table-specs.mjs.
--
-- Накочується на ЛОКАЛЬНИЙ стек ПОВЕРХ сіду пілота, ідемпотентно:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \\
--     -f scripts/dev-stand/seed-demo.sql
-- supabase/seed.sql і scripts/pilot-pack/ НЕ чіпаються — див. README поруч.

-- Зворотні слеші в текстах — звичайні символи, а не escape-послідовності.
set standard_conforming_strings = on;`;

/** Невідома таблиця у вхідних даних — помилка, а не мовчазний пропуск. */
function assertKnownTables(dataset) {
  for (const table of Object.keys(dataset)) {
    if (findSpec(table)) continue;
    throw new Error(
      `Таблиця "${table}" поза allowlist-ом demo-датасету — ` +
        'у сід стенда їдуть лише каталожні таблиці (table-specs.mjs)',
    );
  }
}

/** Рядок, звужений до allowlist-у колонок: усе інше не існує для генератора. */
function sanitizeRow(spec, row) {
  const clean = {};
  for (const column of spec.columns) clean[column] = row[column] ?? null;
  return clean;
}

/** Ключ сортування: природний ключ + `id` тайбрейкером (ключ не унікальний). */
function sortKeyOf(spec, row) {
  const natural = spec.conflictKey.map((column) => row[column] ?? null);
  return JSON.stringify([...natural, row.id ?? null]);
}

/**
 * Батьки перед дітьми для самопосильної таблиці (секції). Цикл у даних не
 * розвʼязуємо — дописуємо решту як є: FK-помилку краще побачити від БД, ніж
 * зациклитись тут.
 */
function orderSelfParent(rows, column) {
  const ids = new Set(rows.map((row) => row.id));
  const emitted = new Set();
  const ordered = [];
  let pending = rows;
  while (pending.length > 0) {
    const ready = pending.filter((row) => {
      const parent = row[column];
      return parent == null || !ids.has(parent) || emitted.has(parent);
    });
    if (ready.length === 0) return [...ordered, ...pending];
    for (const row of ready) {
      ordered.push(row);
      emitted.add(row.id);
    }
    const readySet = new Set(ready);
    pending = pending.filter((row) => !readySet.has(row));
  }
  return ordered;
}

/**
 * Детермінізація: санітизація → дедуп за `id` → сортування за природним
 * ключем із `id` тайбрейкером → топологія самопосилання.
 *
 * 🔴 Дедуп саме за `id` (арбітр `on conflict` — він же): схема ДОЗВОЛЯЄ два
 * глобальні `section_properties` (`section_id = null`) з однаковим слагом —
 * ані NULLS DISTINCT, ані адмінка їх не забороняють, — тож дедуп за природним
 * ключем мовчки викидав би другий рядок разом із валідністю FK у дітей. За
 * `id` він безпечний (у джерелі це PK), а ключ тепер сортує лише в парі з ним.
 */
function prepareRows(spec, rows) {
  const byId = new Map();
  for (const row of rows) {
    const clean = sanitizeRow(spec, row);
    byId.set(clean.id, clean);
  }
  const sorted = [...byId.values()]
    .map((row) => [sortKeyOf(spec, row), row])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, row]) => row);
  return spec.selfParent ? orderSelfParent(sorted, spec.selfParent) : sorted;
}

/** Значення однієї клітинки: похідна колонка — SQL-вираз, решта — літерал. */
function cell(spec, row, column) {
  const derived = spec.derived?.[column];
  if (derived) return derived;
  return toSqlLiteral(row[column], {
    json: (spec.jsonColumns ?? []).includes(column),
  });
}

/** Один `insert ... on conflict do update` на таблицю. */
function renderTable(spec, rows) {
  const prepared = prepareRows(spec, rows);
  const columns = allColumns(spec);
  const values = prepared
    .map((row) => `  (${columns.map((c) => cell(spec, row, c)).join(', ')})`)
    .join(',\n');
  const updates = updateColumns(spec)
    .map((column) => `  ${column} = excluded.${column}`)
    .join(',\n');
  return [
    `-- ${spec.table}: ${prepared.length} рядк.`,
    `insert into public.${spec.table} (`,
    `  ${columns.join(', ')}`,
    ')',
    'values',
    values,
    'on conflict (id) do update set',
    `${updates};`,
  ].join('\n');
}

/** `{ tableName: rows[] }` → повний текст `seed-demo.sql`. */
export function generateSeedSql(dataset) {
  assertKnownTables(dataset);
  const blocks = TABLE_SPECS.filter(
    (spec) => (dataset[spec.table] ?? []).length > 0,
  ).map((spec) => renderTable(spec, dataset[spec.table]));
  if (blocks.length === 0) {
    throw new Error(
      'Порожній датасет: у дампі немає жодного каталожного рядка',
    );
  }
  return `${[HEADER, ...blocks].join('\n\n')}\n`;
}
