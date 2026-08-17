/**
 * Allowlist каталожних таблиць і колонок demo-датасету діагностичного стенда
 * (задача §2 блок C, план Р8).
 *
 * 🔴 Це ЄДИНЕ джерело правди про те, що взагалі може потрапити у вивід:
 * дампер читає рівно ці таблиці й рівно ці колонки, генератор мовчки викидає
 * усе інше. Персональних даних тут немає за побудовою — жодних
 * `profiles`/`orders`/`order_items`/`user_*`/`service_requests`; додавати їх
 * сюди не можна (санітизація — властивість константи, а не дисципліни
 * виклику).
 *
 * `created_at`/`updated_at` свідомо поза allowlist-ом: на стенді дефолти БД
 * доречніші за чужі дати, а менше колонок — менше поверхні витоку.
 *
 * Порядок масиву — ТОПОЛОГІЧНИЙ: батьківські таблиці перед дочірніми.
 */

/** Компактний запис списку колонок (рядок через пробіли → масив). */
const cols = (list) => list.trim().split(/\s+/);

/**
 * Тип-за-замовчуванням цін: на стенді ціни потрібні лише анонімному SSR, а
 * він бере дефолтний тип. Дампер обмежує вибірку саме ним (інакше товар мав
 * би кілька рядків на один унікальний ключ), а генератор підставляє id
 * ЛОКАЛЬНОГО типу — id із клауд-БД у локальному стеку не існує.
 */
const DEFAULT_PRICE_TYPE_SQL =
  '(select id from public.price_types order by is_default desc, sort_order, code limit 1)';

/** Плейсхолдер `coalesce` з унікального індексу `idx_product_prices_unique`. */
const NIL_UUID = "'00000000-0000-0000-0000-000000000000'::uuid";

export const TABLE_SPECS = [
  {
    table: 'sections',
    columns: cols(`id slug name description image_url parent_id sort_order
      is_active meta_title meta_description`),
    // Самопосилання: дерево секцій треба класти батьками вперед.
    selfParent: 'parent_id',
    conflict: ['slug'],
    conflictKey: ['slug'],
  },
  {
    table: 'section_properties',
    columns: cols(`id section_id name slug property_type is_required
      is_filterable has_page sort_order options`),
    jsonColumns: ['options'],
    conflict: ['section_id', 'slug'],
    conflictKey: ['section_id', 'slug'],
  },
  {
    table: 'property_options',
    columns: cols(`id property_id name slug sort_order description image_url
      meta_title meta_description`),
    conflict: ['property_id', 'slug'],
    conflictKey: ['property_id', 'slug'],
  },
  {
    table: 'section_property_assignments',
    columns: cols('id section_id property_id sort_order applies_to'),
    conflict: ['section_id', 'property_id'],
    conflictKey: ['section_id', 'property_id'],
  },
  {
    table: 'products',
    // Окремої таблиці зображень немає — фото живуть у jsonb `images`
    // (публічні URL-и клауд-Storage; дзеркалення — опція, не вимога).
    columns: cols(`id section_id slug name short_description description
      is_active is_featured meta_title meta_description images
      has_modifications sku stock_status`),
    jsonColumns: ['images'],
    conflict: ['slug'],
    conflictKey: ['slug'],
  },
  {
    table: 'product_modifications',
    columns: cols(`id product_id slug name sku is_default images sort_order
      stock_status`),
    jsonColumns: ['images'],
    conflict: ['product_id', 'slug'],
    conflictKey: ['product_id', 'slug'],
  },
  {
    table: 'product_property_values',
    columns: cols('id product_id property_id value numeric_value option_id'),
    conflict: ['product_id', 'property_id'],
    conflictKey: ['product_id', 'property_id'],
  },
  {
    table: 'product_prices',
    columns: cols('id product_id modification_id price old_price'),
    derived: { price_type_id: DEFAULT_PRICE_TYPE_SQL },
    where: `price_type_id = ${DEFAULT_PRICE_TYPE_SQL}`,
    // Ціль конфлікту дзеркалить ВИРАЗНИЙ unique-індекс схеми.
    conflict: [
      'price_type_id',
      'product_id',
      `coalesce(modification_id, ${NIL_UUID})`,
    ],
    conflictKey: ['product_id', 'modification_id'],
  },
];

/** Спека таблиці за іменем або `undefined` (невідома таблиця — не наша). */
export function findSpec(table) {
  return TABLE_SPECS.find((spec) => spec.table === table);
}

/** Усі колонки таблиці у порядку виводу: allowlist + похідні вирази. */
export function allColumns(spec) {
  return [...spec.columns, ...Object.keys(spec.derived ?? {})];
}

/**
 * Колонки `do update set`: усе, крім PK і колонок, за якими виводиться
 * конфлікт (їх значення й так збігається — оновлювати нічого).
 */
export function updateColumns(spec) {
  const plainConflict = spec.conflict.filter((part) => /^[a-z_]+$/.test(part));
  const skip = new Set(['id', ...spec.conflictKey, ...plainConflict]);
  return allColumns(spec).filter((column) => !skip.has(column));
}
