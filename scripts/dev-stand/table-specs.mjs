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

/**
 * 🔴 Арбітр конфлікту скрізь ОДИН — первинний ключ `id`, а не природний ключ
 * таблиці. Причина: природні ключі тут частково NULLABLE
 * (`section_properties.section_id` — глобальна властивість адмінки,
 * `product_prices.modification_id`), а unique-констрейнти Postgres за
 * замовчуванням NULLS DISTINCT — на NULL вони арбітром не працюють, `on
 * conflict` нічого не знаходить і insert падає вже на `*_pkey`, бо `id`
 * дампиться літералом. Той самий `id` рятує й перейменування слага між
 * дампами. Тому `conflictKey` (природний ключ) лишається ЛИШЕ ключем
 * СОРТУВАННЯ рядків у генераторі — у SQL він не потрапляє, а дедуп там теж
 * за `id`: природний ключ на NULLABLE-колонці може легально повторюватись.
 */
export const TABLE_SPECS = [
  {
    table: 'sections',
    columns: cols(`id slug name description image_url parent_id sort_order
      is_active meta_title meta_description`),
    // Самопосилання: дерево секцій треба класти батьками вперед.
    selfParent: 'parent_id',
    conflictKey: ['slug'],
  },
  {
    table: 'section_properties',
    columns: cols(`id section_id name slug property_type is_required
      is_filterable has_page sort_order options`),
    jsonColumns: ['options'],
    conflictKey: ['section_id', 'slug'],
  },
  {
    table: 'property_options',
    columns: cols(`id property_id name slug sort_order description image_url
      meta_title meta_description`),
    conflictKey: ['property_id', 'slug'],
  },
  {
    table: 'section_property_assignments',
    columns: cols('id section_id property_id sort_order applies_to'),
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
    conflictKey: ['slug'],
  },
  {
    table: 'product_modifications',
    columns: cols(`id product_id slug name sku is_default images sort_order
      stock_status`),
    jsonColumns: ['images'],
    conflictKey: ['product_id', 'slug'],
  },
  {
    table: 'product_property_values',
    columns: cols('id product_id property_id value numeric_value option_id'),
    conflictKey: ['product_id', 'property_id'],
  },
  {
    table: 'product_prices',
    columns: cols('id product_id modification_id price old_price'),
    derived: { price_type_id: DEFAULT_PRICE_TYPE_SQL },
    where: `price_type_id = ${DEFAULT_PRICE_TYPE_SQL}`,
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
 * Колонки `do update set`: усе, крім PK — арбітра конфлікту. Колонки
 * природного ключа (slug тощо) сюди ВХОДЯТЬ свідомо: саме так повторний
 * накат підхоплює перейменування, зроблене в джерелі між дампами.
 */
export function updateColumns(spec) {
  return allColumns(spec).filter((column) => column !== 'id');
}
