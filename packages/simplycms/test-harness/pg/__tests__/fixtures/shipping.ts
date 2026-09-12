// Фікстури довідників доставки (В2-К1а, чекаут).
//
// 🔴 Канонічний сід способів доставки НЕ везе — їх заводить магазин. Тому
// без цих рядків тест «віддає активні, ховає неактивні» був би зеленим на
// порожній множині, тобто не доводив би нічого. Кожної сутності по ДВА
// рядки: активний і вимкнений.

/** Активний спосіб доставки — самовивіз. */
export const ACTIVE_METHOD_CODE = 'pickup';
/** Вимкнений спосіб доставки — не має доїхати до вітрини. */
export const HIDDEN_METHOD_CODE = 'hidden-courier';
/** Активна зона за замовчуванням. */
export const ACTIVE_ZONE_NAME = 'Уся Україна';
/** Вимкнена зона. */
export const HIDDEN_ZONE_NAME = 'Вимкнена зона';
/** Активна точка видачі. */
export const ACTIVE_POINT_NAME = 'Склад №1';
/** Вимкнена точка видачі. */
export const HIDDEN_POINT_NAME = 'Закритий склад';
/** Тариф `free_from`: понад цей поріг доставка безкоштовна. */
export const FREE_FROM_AMOUNT = 5000;
/** Базова вартість активного тарифу. */
export const BASE_COST = 120;

/**
 * 🔴 Дві частини (К2-Е0). АКТИВНІ рядки потрібні лише на чистому каноні
 * (`shipping-directory.test.ts`): демо-сід везе власні `pickup`, дефолтну
 * зону, точку й безкоштовний тариф, тож поверх сіду активна частина — no-op
 * (метод/зона — `on conflict`, тариф і точка — `where not exists` за іменем).
 * НЕГАТИВНІ рядки (вимкнений метод, вимкнена зона, вимкнений тариф, закрита
 * точка) безпечні в обох контурах — саме їх композують тести поверх сіду.
 * Повний набір поверх сіду НЕ застосовувати: другий активний тариф на ту
 * саму пару метод+зона зробив би вартість доставки залежною від порядку
 * читання рядків з однаковим sort_order.
 */
export const ACTIVE_SHIPPING_FIXTURES: string[] = [
  `insert into public.shipping_methods (id, code, name, is_active, sort_order)
     values (gen_random_uuid(), '${ACTIVE_METHOD_CODE}', 'Самовивіз', true, 1)
   on conflict (code) do nothing`,

  `insert into public.shipping_zones (id, name, is_active, is_default, cities)
     values (gen_random_uuid(), '${ACTIVE_ZONE_NAME}', true, true, '{}')
   on conflict (is_default) where (is_default = true) do nothing`,

  // Тариф активний, але зона й метод у нього — активні: перевіряємо саме
  // власний `is_active` тарифу, а не побічний ефект від батьків.
  // 🔴 Пошук зони — за `is_default`, а не за іменем: поверх демо-сіду власна
  // '${ACTIVE_ZONE_NAME}' не вставиться (конфлікт по частковому індексу), а
  // дефолтна зона сіду називається інакше.
  `insert into public.shipping_rates
     (id, method_id, zone_id, name, calculation_type, base_cost, free_from_amount, is_active)
   select gen_random_uuid(), m.id, z.id, 'Основний тариф', 'free_from', ${BASE_COST}, ${FREE_FROM_AMOUNT}, true
     from public.shipping_methods m, public.shipping_zones z
    where m.code = '${ACTIVE_METHOD_CODE}' and z.is_default = true
      and not exists (select 1 from public.shipping_rates where name = 'Основний тариф')`,

  `insert into public.pickup_points (id, method_id, name, address, city, is_active)
   select gen_random_uuid(), m.id, '${ACTIVE_POINT_NAME}', 'вул. Тестова, 1', 'Київ', true
     from public.shipping_methods m
    where m.code = '${ACTIVE_METHOD_CODE}'
      and not exists (select 1 from public.pickup_points where name = '${ACTIVE_POINT_NAME}')`,
];

export const HIDDEN_SHIPPING_FIXTURES: string[] = [
  `insert into public.shipping_methods (id, code, name, is_active, sort_order)
     values (gen_random_uuid(), '${HIDDEN_METHOD_CODE}', 'Вимкнений курʼєр', false, 2)
   on conflict (code) do nothing`,

  `insert into public.shipping_zones (id, name, is_active, is_default, cities)
     values (gen_random_uuid(), '${HIDDEN_ZONE_NAME}', false, false, '{}')`,

  `insert into public.shipping_rates
     (id, method_id, zone_id, name, calculation_type, base_cost, is_active)
   select gen_random_uuid(), m.id, z.id, 'Вимкнений тариф', 'flat', 999, false
     from public.shipping_methods m, public.shipping_zones z
    where m.code = '${ACTIVE_METHOD_CODE}' and z.is_default = true`,

  `insert into public.pickup_points (id, method_id, name, address, city, is_active)
   select gen_random_uuid(), m.id, '${HIDDEN_POINT_NAME}', 'вул. Тестова, 2', 'Київ', false
     from public.shipping_methods m where m.code = '${ACTIVE_METHOD_CODE}'`,
];

export const SHIPPING_FIXTURES: string[] = [
  ...ACTIVE_SHIPPING_FIXTURES,
  ...HIDDEN_SHIPPING_FIXTURES,
];
