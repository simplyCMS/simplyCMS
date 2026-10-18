/**
 * Allowlist каталожних таблиць і колонок demo-датасету діагностичного стенда
 * (задача §2 блок C, план Р8).
 *
 * 🔴 Це ЄДИНЕ джерело правди про те, що взагалі може потрапити у вивід:
 * дампер читає рівно ці таблиці й рівно ці колонки, генератор мовчки викидає
 * усе інше. Персональних даних тут немає за побудовою — жодних
 * `profiles`/`orders`/`order_items`/`user_*`; додавати їх
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
 * Основна мова локальної БД (М1): переклади, адреси й токени стенда пишуться ЛИШЕ нею.
 * Колонка `locale` не дампиться, а підставляється цим підзапитом (як `price_type_id`):
 * мова з клауд-БД у локальному стеку може не існувати (FK `locale → languages(code)`).
 * Джерело фільтрується тим самим виразом на ЇЇ основній мові (`localeWhere`).
 */
const PRIMARY_LOCALE_SQL =
  '(select code from public.languages where is_default)';
const localeWhere = `locale = ${PRIMARY_LOCALE_SQL}`;

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
  // 🔴 Товар і модифікація — лише нетекстові колонки (М1): назви й описи — у перекладах,
  // адреса й токен — у реєстрах, фото — у `product_images`. Сід — одна транзакція, тож
  // відкладені тригери (І4 джерела, І16 наявності адреси/токена) перевіряють граф на COMMIT.
  {
    table: 'products',
    columns: cols(`id section_id is_active is_featured has_modifications sku
      stock_status`),
    conflictKey: ['id'],
  },
  {
    table: 'product_modifications',
    columns: cols('id product_id sku is_default sort_order stock_status'),
    conflictKey: ['product_id', 'sort_order', 'id'],
  },
  {
    // Текст значення `value_kind = text` — у перекладі (І5), не в рядку значення.
    table: 'product_property_values',
    columns: cols(`id product_id property_id value_kind numeric_value
      bool_value color_value option_id`),
    conflictKey: ['product_id', 'property_id'],
  },
  // ── Переклади, адреси, токени й зображення товару (М1). Таблиці перекладів не
  // мають `id`: арбітр — складений PK `(<e>_id, locale)` (`conflictTarget`), а
  // дедуп у генераторі — за `dedupeKey` (locale завжди одна — основна локальна).
  {
    table: 'product_translations',
    columns: cols(`product_id name short_description description meta_title
      meta_description`),
    // CHECK у схемі: плоске поле — NULL або з текстом, тож порожнє з джерела -> NULL.
    blankToNull: [
      'name',
      'short_description',
      'meta_title',
      'meta_description',
    ],
    derived: { locale: PRIMARY_LOCALE_SQL },
    where: localeWhere,
    conflictTarget: ['product_id', 'locale'],
    dedupeKey: ['product_id'],
    conflictKey: ['product_id'],
  },
  {
    table: 'product_modification_translations',
    columns: cols('product_id modification_id name'),
    derived: { locale: PRIMARY_LOCALE_SQL },
    where: localeWhere,
    conflictTarget: ['modification_id', 'locale'],
    dedupeKey: ['modification_id'],
    conflictKey: ['modification_id'],
  },
  {
    table: 'product_images',
    columns: cols('id product_id modification_id storage_key sort_order'),
    conflictKey: ['product_id', 'sort_order'],
  },
  {
    table: 'product_image_translations',
    columns: cols('image_id alt storage_key'),
    derived: { locale: PRIMARY_LOCALE_SQL },
    where: localeWhere,
    conflictTarget: ['image_id', 'locale'],
    dedupeKey: ['image_id'],
    conflictKey: ['image_id'],
  },
  {
    table: 'product_property_value_translations',
    columns: cols('value_id value'),
    derived: { locale: PRIMARY_LOCALE_SQL },
    where: localeWhere,
    conflictTarget: ['value_id', 'locale'],
    dedupeKey: ['value_id'],
    conflictKey: ['value_id'],
  },
  {
    table: 'url_paths',
    columns: cols('id path product_id is_current'),
    derived: { locale: PRIMARY_LOCALE_SQL },
    where: localeWhere,
    conflictKey: ['product_id', 'path'],
  },
  {
    table: 'slug_tokens',
    columns: cols('id scope_id slug modification_id is_current'),
    derived: { locale: PRIMARY_LOCALE_SQL },
    where: localeWhere,
    conflictKey: ['modification_id', 'slug'],
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
  const key = conflictTarget(spec);
  return allColumns(spec).filter((column) => !key.includes(column));
}

/** Арбітр `on conflict`: `id` або складений PK таблиці перекладів. */
export function conflictTarget(spec) {
  return spec.conflictTarget ?? ['id'];
}
