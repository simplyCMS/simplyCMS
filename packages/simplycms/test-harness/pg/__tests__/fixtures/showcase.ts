// Фікстури контуру «знижки, відгуки, банери, залишки» (В2-К1а, останнє кільце).
//
// 🔴 Поверх демо-сіду: демо не має ні знижок, ні відгуків, ні точок видачі,
// тож усі чотири правила перевірялися б на порожній множині — тобто не
// перевірялися б.

/** Категорія, на яку націлена акція. Тип ціни в неї той САМИЙ, що в роздрібу: */
/** інакше гуртовик не побачив би роздрібних правил і тест доводив би не те. */
export const WHOLESALE_CODE = 'wholesale';
/** Відсоток знижки, який мусить дістатися лише гуртовику. */
export const DISCOUNT_PERCENT = 10;
/** Назва акції, націленої на категорію. */
export const TARGETED_DISCOUNT = 'Гуртова знижка';
/** Назва вимкненої акції — негативний контроль предиката `is_active`. */
export const DISABLED_DISCOUNT = 'Вимкнена акція';

/** Пошти акторів: id беруться з БД після вставки. */
export const RETAIL_EMAIL = 'retail@example.test';
export const WHOLESALE_EMAIL = 'wholesale@example.test';
export const REVIEWER_EMAIL = 'reviewer@example.test';
/** Підпис автора відгуку — його вітрина показує поруч із зірками. */
export const REVIEWER_FIRST_NAME = 'Оксана';

/** Товар, на якому міряються відгуки й рейтинг. */
export const REVIEWED_PRODUCT_SLUG = 'sonyachna-panel-450w-mono';
/** Схвалені оцінки й нерозглянута — агрегат мусить порахувати лише перші дві. */
export const APPROVED_RATINGS = [5, 4];
export const PENDING_RATING = 1;

/** Місце розміщення банерів, яке читає каркас вітрини. */
export const BANNER_PLACEMENT = 'home';
export const HIDDEN_BANNER_TITLE = 'Вимкнений банер';
export const EXPIRED_BANNER_TITLE = 'Прострочений банер';

/** Товар із модифікаціями — на ньому міряються залишки. */
export const STOCK_PRODUCT_SLUG = 'invertor-merezhevyi-5kw';
export const STOCK_MOD_SLUG = 'odnofazny';
export const OPEN_POINT_NAME = 'Склад відкритий';
export const CLOSED_POINT_NAME = 'Склад закритий';
export const OPEN_POINT_QUANTITY = 7;
export const CLOSED_POINT_QUANTITY = 100;

export const SHOWCASE_FIXTURE_STATEMENTS: string[] = [
  // ── Категорії й актори ──────────────────────────────────────────────────
  `insert into public.user_categories (name, code, is_default, price_type_id)
   select 'Гурт', '${WHOLESALE_CODE}', false, id
     from public.price_types where code = 'retail'`,

  `insert into public.users (name, email, email_verified)
   values ('Роздрібний', '${RETAIL_EMAIL}', true),
          ('Гуртовий', '${WHOLESALE_EMAIL}', true),
          ('Оксана Авторка', '${REVIEWER_EMAIL}', true)`,

  `insert into public.profiles (user_id, email, first_name, category_id)
   select u.id, u.email, 'Роздрібний', c.id
     from public.users u
     cross join public.user_categories c
    where u.email = '${RETAIL_EMAIL}' and c.code = 'retail'`,

  `insert into public.profiles (user_id, email, first_name, category_id)
   select u.id, u.email, 'Гуртовий', c.id
     from public.users u
     cross join public.user_categories c
    where u.email = '${WHOLESALE_EMAIL}' and c.code = '${WHOLESALE_CODE}'`,

  `insert into public.profiles (user_id, email, first_name, category_id)
   select u.id, u.email, '${REVIEWER_FIRST_NAME}', c.id
     from public.users u
     cross join public.user_categories c
    where u.email = '${REVIEWER_EMAIL}' and c.code = 'retail'`,

  // ── Знижки ──────────────────────────────────────────────────────────────
  `insert into public.discount_groups (name, operator, is_active)
   values ('Акції магазину', 'and', true)`,

  `insert into public.discounts
     (name, group_id, discount_type, discount_value, is_active, price_type_id)
   select '${TARGETED_DISCOUNT}', g.id, 'percent', ${DISCOUNT_PERCENT}, true, pt.id
     from public.discount_groups g
     cross join public.price_types pt
    where g.name = 'Акції магазину' and pt.code = 'retail'`,

  `insert into public.discounts
     (name, group_id, discount_type, discount_value, is_active, price_type_id)
   select '${DISABLED_DISCOUNT}', g.id, 'percent', 90, false, pt.id
     from public.discount_groups g
     cross join public.price_types pt
    where g.name = 'Акції магазину' and pt.code = 'retail'`,

  `insert into public.discount_conditions (discount_id, condition_type, operator, value)
   select d.id, 'user_category', 'in',
          to_jsonb(array[(select id::text from public.user_categories where code = '${WHOLESALE_CODE}')])
     from public.discounts d where d.name = '${TARGETED_DISCOUNT}'`,

  `insert into public.discount_targets (discount_id, target_type, target_id)
   select d.id, 'all', null from public.discounts d
    where d.name = '${TARGETED_DISCOUNT}'`,

  // ── Банери: вимкнений і прострочений ────────────────────────────────────
  `insert into public.banners (title, image_url, placement, sort_order, is_active)
   values ('${HIDDEN_BANNER_TITLE}', '/hidden.jpg', '${BANNER_PLACEMENT}', 90, false)`,

  `insert into public.banners (title, image_url, placement, sort_order, is_active, date_to)
   values ('${EXPIRED_BANNER_TITLE}', '/expired.jpg', '${BANNER_PLACEMENT}', 91, true,
           now() - interval '1 day')`,

  // ── Точки видачі: відкрита й закрита, обидві із залишком ─────────────────
  `insert into public.shipping_methods (code, name, is_active)
   values ('pickup', 'Самовивіз', true)`,

  `insert into public.pickup_points (method_id, name, address, city, is_active, sort_order)
   select m.id, '${OPEN_POINT_NAME}', 'вул. Відкрита, 1', 'Київ', true, 0
     from public.shipping_methods m where m.code = 'pickup'`,

  `insert into public.pickup_points (method_id, name, address, city, is_active, sort_order)
   select m.id, '${CLOSED_POINT_NAME}', 'вул. Закрита, 2', 'Київ', false, 1
     from public.shipping_methods m where m.code = 'pickup'`,

  `insert into public.stock_by_pickup_point (pickup_point_id, modification_id, quantity)
   select pp.id, m.id,
          case when pp.is_active then ${OPEN_POINT_QUANTITY} else ${CLOSED_POINT_QUANTITY} end
     from public.pickup_points pp
     cross join public.product_modifications m
     join public.products p on p.id = m.product_id
    where p.slug = '${STOCK_PRODUCT_SLUG}' and m.slug = '${STOCK_MOD_SLUG}'`,

  // ── Відгуки: дві схвалені оцінки й одна нерозглянута ─────────────────────
  `insert into public.product_reviews (product_id, user_id, rating, title, status)
   select p.id, u.id, ${APPROVED_RATINGS[0]}, 'Чудова панель', 'approved'
     from public.products p cross join public.users u
    where p.slug = '${REVIEWED_PRODUCT_SLUG}' and u.email = '${REVIEWER_EMAIL}'`,

  `insert into public.product_reviews (product_id, user_id, rating, title, status)
   select p.id, u.id, ${APPROVED_RATINGS[1]}, 'Норм', 'approved'
     from public.products p cross join public.users u
    where p.slug = '${REVIEWED_PRODUCT_SLUG}' and u.email = '${RETAIL_EMAIL}'`,

  `insert into public.product_reviews (product_id, user_id, rating, title, status)
   select p.id, u.id, ${PENDING_RATING}, 'Ще на модерації', 'pending'
     from public.products p cross join public.users u
    where p.slug = '${REVIEWED_PRODUCT_SLUG}' and u.email = '${WHOLESALE_EMAIL}'`,
];
