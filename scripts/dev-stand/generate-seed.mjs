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
  conflictTarget,
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
-- Накочується на ЛОКАЛЬНУ чисту Postgres-БД із накатаним каноном міграцій,
-- ідемпотентно:
--   psql "$DATABASE_URL" -f scripts/dev-stand/seed-demo.sql
-- scripts/pilot-pack/ НЕ чіпається — див. README поруч.

-- Зворотні слеші в текстах — звичайні символи, а не escape-послідовності.
set standard_conforming_strings = on;

-- Записи в \`url_paths\` і \`slug_tokens\` (М1, тригер SC004) — лише під замком мов,
-- а замок \`xact\` живе рівно до COMMIT, тож увесь сід — одна транзакція.
begin;
select pg_advisory_xact_lock_shared(hashtextextended('languages-set', 0));`;

/**
 * Проєкція тексту товару (М1, Task 14, І23) будується кроком САМОГО сіду з щойно
 * записаних перекладів і адрес: вітрина читає `catalog_product_texts`, а дамп її не
 * містить (похідна таблиця). Стенд пише лише основну мову, тож fallback-а немає, але
 * вираз той самий, що в `catalog-projection/expected.ts` (рядок = мова draft/published
 * з поточною адресою; `is_translated` за правилом «непорожнє в джерелі -> непорожнє в мові»).
 */
const PROJECTION_FIELDS = [
  'name',
  'short_description',
  'description',
  'meta_title',
  'meta_description',
];
export const PROJECTION_STEP = `-- catalog_product_texts: похідна проєкція (будується з product_translations і url_paths)
insert into public.catalog_product_texts (
  product_id, locale, ${PROJECTION_FIELDS.join(', ')}, path, is_translated, fallback_fields
)
select p.id, l.code, ${PROJECTION_FIELDS.map((f) => `coalesce(t.${f}, s.${f})`).join(', ')}, u.path,
       (t.product_id is not null and ${PROJECTION_FIELDS.map((f) => `(s.${f} is null or t.${f} is not null)`).join(' and ')}),
       array_remove(array[${PROJECTION_FIELDS.map((f) => `case when s.${f} is not null and t.${f} is null then '${f}' end`).join(', ')}], null)::text[]
  from public.products p
  join public.languages l on l.status in ('draft', 'published')
  join public.url_paths u on u.product_id = p.id and u.locale = l.code and u.is_current
  join public.product_translations s
    on s.product_id = p.id and s.locale = (select code from public.languages where is_default)
  left join public.product_translations t on t.product_id = p.id and t.locale = l.code
 where coalesce(t.name, s.name) is not null
on conflict (product_id, locale) do update set
${[...PROJECTION_FIELDS, 'path', 'is_translated', 'fallback_fields'].map((c) => `  ${c} = excluded.${c}`).join(',\n')};`;

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

/** Той самий клас «непорожніх» символів, що CHECK у `schema.ts` (`NON_BLANK`). */
const BLANK_FREE =
  /[^\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\u00AD\u180E\u200B-\u200D\u2060\uFEFF]/;

/** Рядок, звужений до allowlist-у колонок: усе інше не існує для генератора. */
function sanitizeRow(spec, row) {
  const clean = {};
  for (const column of spec.columns) clean[column] = row[column] ?? null;
  // CHECK `product_translations_*_text`: плоске перекладне поле — NULL або з текстом;
  // порожній рядок із джерела (`''`, самі пробіли) на стенді стає NULL, а не падінням накату.
  for (const column of spec.blankToNull ?? [])
    if (typeof clean[column] === 'string' && !BLANK_FREE.test(clean[column]))
      clean[column] = null;
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
 * 🔴 Дедуп саме за `id` (арбітр `on conflict` — він же): у джерелі це PK, тож
 * дедуп за ним безпечний, а природний ключ сортує лише в парі з ним. Двох
 * глобальних `section_properties` з однаковим слагом схема більше НЕ дозволяє
 * (Е4-6: `section_properties_slug_key UNIQUE(slug)` — унікальність глобальна,
 * без `section_id` у ключі), тож такий дамп упав би на констрейнті ще при
 * накаті; дедуп за `id` від цього не залежить.
 */
function prepareRows(spec, rows) {
  // Дедуп за арбітром конфлікту: `id`, а для таблиць перекладів — `dedupeKey`
  // (їхній складений PK без `locale`, бо мова завжди одна — основна локальна).
  const dedupeBy = spec.dedupeKey ?? ['id'];
  const byId = new Map();
  for (const row of rows) {
    const clean = sanitizeRow(spec, row);
    byId.set(JSON.stringify(dedupeBy.map((c) => clean[c])), clean);
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
    `on conflict (${conflictTarget(spec).join(', ')}) do update set`,
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
  return `${[HEADER, ...blocks, PROJECTION_STEP, 'commit;'].join('\n\n')}\n`;
}
