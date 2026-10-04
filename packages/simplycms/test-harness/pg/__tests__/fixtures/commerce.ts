// Фікстури контуру `simplycms/commerce` (К3-Е5б, Task 1) поверх демо-сіду.
//
// 🔴 Id знижок і груп — ФІКСОВАНІ, а не `gen_random_uuid()`: оракул ціноутворення
// асертить `discountData` цілком (id застосованої знижки — частина знімка позиції),
// і випадковий id робив би асерт або нестабільним, або неповним.

/** Товари демо-сіду (id — фіксовані в `demo-seed.sql`). */
export const PANEL_450 = '10000002-0000-4000-8000-000000000001';
export const PANEL_550 = '10000002-0000-4000-8000-000000000002';
export const INVERTER_5KW = '10000002-0000-4000-8000-000000000004';
export const INVERTER_5KW_1PH = '10000003-0000-4000-8000-000000000001';
export const INVERTER_8KW = '10000002-0000-4000-8000-000000000005';
export const BATTERY_200AH = '10000002-0000-4000-8000-000000000007';
export const STATION_10KWH = '10000002-0000-4000-8000-000000000008';

/** Знижка оракула: −10 % на панель 450 для категорії «Роздріб» (дефолтна — її має й гість). */
export const ORACLE_GROUP = 'Акція оракула';
export const ORACLE_DISCOUNT_ID = 'c0000001-0000-4000-8000-000000000002';
export const ORACLE_DISCOUNT = 'Панель −10%';

/** Знижка «від суми кошика»: −5 % на акумулятор 200 Аг, якщо кошик ≥ 50000. */
export const CART_GROUP = 'Акція від суми';
export const CART_DISCOUNT_ID = 'c0000001-0000-4000-8000-000000000004';
export const CART_DISCOUNT = 'Від 50000 — 5%';
export const CART_THRESHOLD = 50000;

/** Гуртовий тип ціни й категорія; станція коштує гуртовику 60000 замість 68000. */
export const WHOLESALE_EMAIL = 'commerce-wholesale@example.test';
export const WHOLESALE_STATION_PRICE = 60000;

/** Курʼєр контуру: `free_from` 10000, мінімум замовлення 1000, базова 150. */
export const COURIER_CODE = 'commerce-courier';
export const COURIER_BASE = 150;
export const COURIER_FREE_FROM = 10000;
export const COURIER_MIN_ORDER = 1000;

const group = (id: string, name: string): string =>
  `insert into public.discount_groups (id, name, operator, is_active)
   values ('${id}', '${name}', 'and', true)`;

const percent = (id: string, name: string, groupId: string, value: number) =>
  `insert into public.discounts (id, name, group_id, discount_type, discount_value, is_active, price_type_id)
   select '${id}', '${name}', '${groupId}', 'percent', ${value}, true, pt.id
     from public.price_types pt where pt.code = 'retail'`;

const target = (discountId: string, productId: string): string =>
  `insert into public.discount_targets (id, discount_id, target_type, target_id)
   values (gen_random_uuid(), '${discountId}', 'product', '${productId}')`;

export const COMMERCE_FIXTURE_STATEMENTS: string[] = [
  group('c0000001-0000-4000-8000-000000000001', ORACLE_GROUP),
  percent(
    ORACLE_DISCOUNT_ID,
    ORACLE_DISCOUNT,
    'c0000001-0000-4000-8000-000000000001',
    10,
  ),
  `insert into public.discount_conditions (id, discount_id, condition_type, operator, value)
   select gen_random_uuid(), '${ORACLE_DISCOUNT_ID}', 'user_category', 'in',
          to_jsonb(array[(select id::text from public.user_categories where code = 'retail')])`,
  target(ORACLE_DISCOUNT_ID, PANEL_450),

  group('c0000001-0000-4000-8000-000000000003', CART_GROUP),
  percent(
    CART_DISCOUNT_ID,
    CART_DISCOUNT,
    'c0000001-0000-4000-8000-000000000003',
    5,
  ),
  `insert into public.discount_conditions (id, discount_id, condition_type, operator, value)
   values (gen_random_uuid(), '${CART_DISCOUNT_ID}', 'min_order_amount', '>=', '${CART_THRESHOLD}'::jsonb)`,
  target(CART_DISCOUNT_ID, BATTERY_200AH),

  `insert into public.price_types (id, name, code, is_default, sort_order)
   values ('c0000002-0000-4000-8000-000000000001', 'Гурт контуру', 'commerce-wholesale', false, 9)`,
  `insert into public.user_categories (id, name, code, is_default, price_type_id)
   values ('c0000002-0000-4000-8000-000000000002', 'Гурт контуру', 'commerce-wholesale', false,
           'c0000002-0000-4000-8000-000000000001')`,
  `insert into public.product_prices (id, price_type_id, product_id, modification_id, price)
   values (gen_random_uuid(), 'c0000002-0000-4000-8000-000000000001', '${STATION_10KWH}', null,
           ${WHOLESALE_STATION_PRICE})`,
  `insert into public.users (name, email, email_verified)
   values ('Гуртовик', '${WHOLESALE_EMAIL}', true)`,
  `insert into public.profiles (id, user_id, email, first_name, category_id)
   select gen_random_uuid(), u.id, u.email, 'Гуртовик', 'c0000002-0000-4000-8000-000000000002'
     from public.users u where u.email = '${WHOLESALE_EMAIL}'`,

  `insert into public.shipping_methods (id, code, name, is_active)
   values (gen_random_uuid(), '${COURIER_CODE}', 'Курʼєр контуру', true)`,
  `insert into public.shipping_rates
     (id, method_id, zone_id, name, calculation_type, base_cost, free_from_amount, min_order_amount, is_active, sort_order)
   select gen_random_uuid(), m.id, z.id, 'Тариф курʼєра контуру', 'free_from',
          ${COURIER_BASE}, ${COURIER_FREE_FROM}, ${COURIER_MIN_ORDER}, true, 0
     from public.shipping_methods m, public.shipping_zones z
    where m.code = '${COURIER_CODE}' and z.is_default = true`,
  // Панель 550 — недоступна до купівлі: кейс пріоритету відмов.
  `update public.products set stock_status = 'out_of_stock' where id = '${PANEL_550}'`,
];
