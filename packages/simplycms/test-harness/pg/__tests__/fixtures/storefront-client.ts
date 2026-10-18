// Фікстури контуру «браузер більше не ходить у базу» (В2-К1а).
//
// 🔴 Поверх демо-сіду й фікстур `./storefront`: сід має залишки лише для
// простих товарів, тож наявність модифікацій і характеристики картки
// перевірялися б на порожній множині — тому тут складський рядок для
// модифікації й характеристика на ній.

import { randomUUID } from 'node:crypto';
import { sqlRef, valueGraphSql } from './product-graph';
import { modificationIdBySlug, productIdBySlug } from './product-sql';

/** Розділ, на якому міряється звуження вибірки й панель фільтрів. */
export const FILTERED_SECTION_SLUG = 'sonyachni-paneli';
/** Товар із модифікаціями — на ньому міряються залишки й характеристики. */
export const MODIFIED_PRODUCT_SLUG = 'invertor-merezhevyi-5kw';
/** Модифікація, у якої є залишок на точці видачі. */
export const IN_STOCK_MOD_SLUG = 'odnofazny';
/** Модифікація зі статусом `out_of_stock` — негативний контроль наявності
 * (К2-Е0: статус, не кількість). */
export const OUT_OF_STOCK_MOD_SLUG = 'tryfazny';
/** Скільки одиниць лежить на точці видачі. */
export const STOCK_QUANTITY = 7;

/** Код способу доставки — потрібен і точці видачі, і оформленню замовлення. */
export const SHIPPING_METHOD_CODE = 'pickup';

/** Модифікація товару фікстури за її токеном основної мови. */
const modId = (slug: string) =>
  modificationIdBySlug(
    productIdBySlug(`'${MODIFIED_PRODUCT_SLUG}'`),
    `'${slug}'`,
  );

export const CLIENT_FIXTURE_STATEMENTS: string[] = [
  // Спосіб доставки `pickup` — із демо-сіду; точка видачі без `method_id`
  // не вставляється, тож заводимо власну точку тут.
  `insert into public.pickup_points (id, method_id, name, address, city, is_active)
   select gen_random_uuid(), m.id, 'Склад №1', 'вул. Тестова, 1', 'Київ', true
     from public.shipping_methods m where m.code = '${SHIPPING_METHOD_CODE}'`,

  // Залишок рівно однієї модифікації: друга мусить лишитись недоступною.
  `insert into public.stock_by_pickup_point (id, pickup_point_id, modification_id, quantity)
   select gen_random_uuid(), pp.id, ${modId(IN_STOCK_MOD_SLUG)}, ${STOCK_QUANTITY}
     from public.pickup_points pp
    where pp.name = 'Склад №1'`,

  // Негативний контроль правила «статус — джерело правди»: без цього рядка
  // модифікація без залишку була б ДОСТУПНОЮ (DEFAULT статусу — in_stock).
  `update public.product_modifications
      set stock_status = 'out_of_stock'
    where id = ${modId(OUT_OF_STOCK_MOD_SLUG)}`,

  // Характеристика НА МОДИФІКАЦІЇ: саме її старий клієнт тягнув окремим
  // запитом, а наявність — ще й окремим RPC на кожну модифікацію.
  valueGraphSql(
    {
      kind: 'modification',
      id: sqlRef(modId(IN_STOCK_MOD_SLUG)),
    },
    {
      id: randomUUID(),
      propertyId: sqlRef(
        `(select id from public.section_properties where slug = 'tip-invertora')`,
      ),
      kind: 'select',
      optionId: sqlRef(
        `(select po.id from public.property_options po
            join public.section_properties sp on sp.id = po.property_id
           where sp.slug = 'tip-invertora' and po.slug = 'on-grid')`,
      ),
    },
  ),
];
