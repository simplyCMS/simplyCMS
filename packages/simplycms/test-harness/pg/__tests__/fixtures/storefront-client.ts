// Фікстури контуру «браузер більше не ходить у базу» (В2-К1а).
//
// 🔴 Поверх демо-сіду й фікстур `./storefront`: демо не має ні складських
// рядків, ні характеристик модифікацій, тож наявність і таблиця характеристик
// картки перевірялися б на порожній множині — тобто не перевірялися б.

/** Розділ, на якому міряється звуження вибірки й панель фільтрів. */
export const FILTERED_SECTION_SLUG = 'sonyachni-paneli';
/** Товар із модифікаціями — на ньому міряються залишки й характеристики. */
export const MODIFIED_PRODUCT_SLUG = 'invertor-merezhevyi-5kw';
/** Модифікація, у якої є залишок на точці видачі. */
export const IN_STOCK_MOD_SLUG = 'odnofazny';
/** Модифікація без залишку — негативний контроль наявності. */
export const OUT_OF_STOCK_MOD_SLUG = 'tryfazny';
/** Скільки одиниць лежить на точці видачі. */
export const STOCK_QUANTITY = 7;

/** Код способу доставки — потрібен і точці видачі, і оформленню замовлення. */
export const SHIPPING_METHOD_CODE = 'pickup';

export const CLIENT_FIXTURE_STATEMENTS: string[] = [
  // Канонічний сід способів доставки не везе (їх заводить магазин), а точка
  // видачі без `method_id` не вставляється — тож заводимо обидва тут.
  `insert into public.shipping_methods (id, code, name, is_active)
     values (gen_random_uuid(), '${SHIPPING_METHOD_CODE}', 'Самовивіз', true)`,

  `insert into public.pickup_points (id, method_id, name, address, city, is_active)
   select gen_random_uuid(), m.id, 'Склад №1', 'вул. Тестова, 1', 'Київ', true
     from public.shipping_methods m where m.code = '${SHIPPING_METHOD_CODE}'`,

  // Залишок рівно однієї модифікації: друга мусить лишитись недоступною.
  `insert into public.stock_by_pickup_point (id, pickup_point_id, modification_id, quantity)
   select gen_random_uuid(), pp.id, m.id, ${STOCK_QUANTITY}
     from public.pickup_points pp
     cross join public.product_modifications m
     join public.products p on p.id = m.product_id
    where p.slug = '${MODIFIED_PRODUCT_SLUG}'
      and m.slug = '${IN_STOCK_MOD_SLUG}'
      and pp.name = 'Склад №1'`,

  // Характеристика НА МОДИФІКАЦІЇ: саме її старий клієнт тягнув окремим
  // запитом, а наявність — ще й окремим RPC на кожну модифікацію.
  `insert into public.modification_property_values (id, modification_id, property_id, option_id)
   select gen_random_uuid(), m.id, sp.id, po.id
     from public.product_modifications m
     join public.products p on p.id = m.product_id
     join public.section_properties sp on sp.slug = 'tip-invertora'
     join public.property_options po
       on po.property_id = sp.id and po.slug = 'on-grid'
    where p.slug = '${MODIFIED_PRODUCT_SLUG}'
      and m.slug = '${IN_STOCK_MOD_SLUG}'`,
];
