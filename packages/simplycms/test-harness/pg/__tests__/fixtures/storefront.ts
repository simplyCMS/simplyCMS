// Фікстури контуру вітрини поверх демо-сіду (В2-К1а).
//
// 🔴 Демо-сід навмисно НЕ містить нічого прихованого — він показує магазин.
// Негативний контроль фільтрів видимості тому доводиться дописувати тут:
// без жодного неактивного рядка тест «не віддає неактивні» був би зеленим
// на порожній множині, тобто не доводив би нічого.

/** Розділ, якого вітрина не має бачити. */
export const HIDDEN_SECTION_SLUG = 'prykhovanyi-rozdil';
/** Товар-чернетка: неактивний, але позначений «популярним». */
export const HIDDEN_PRODUCT_SLUG = 'chernetka-tovaru';
/** Активний товар демо-сіду з цінами й характеристиками. */
export const VISIBLE_PRODUCT_SLUG = 'sonyachna-panel-450w-mono';
/** Кореневий розділ, на якому міряється per-section limit головної. */
export const FILLED_SECTION_SLUG = 'akumulyatory';
/** Характеристика з публічною сторінкою. */
export const PAGED_PROPERTY_SLUG = 'tip-paneli';
/** Характеристика БЕЗ публічної сторінки (демо лишає `has_page = false`). */
export const UNPAGED_PROPERTY_SLUG = 'potuzhnist';
/** Опція, за якою будується сторінка значення характеристики. */
export const PAGED_OPTION_SLUG = 'mono';
/** Скільки товарів карусель розділу показує на головній. */
export const PER_SECTION_LIMIT = 8;

export const FIXTURE_STATEMENTS: string[] = [
  // Демо лишає всі характеристики без сторінки — вмикаємо рівно одну.
  `update public.section_properties set has_page = true
     where slug = '${PAGED_PROPERTY_SLUG}'`,

  `insert into public.sections (slug, name, sort_order, is_active)
     values ('${HIDDEN_SECTION_SLUG}', 'Прихований розділ', 99, false)`,

  // Чернетка: неактивна, але «популярна» й у активному розділі — тобто
  // потрапила б у КОЖНУ добірку, якби фільтр видимості загубився.
  `insert into public.products
     (slug, name, section_id, is_active, is_featured, has_modifications, stock_status, images)
   select '${HIDDEN_PRODUCT_SLUG}', 'Чернетка товару', s.id, false, true, false, 'in_stock', '[]'::jsonb
     from public.sections s where s.slug = 'sonyachni-paneli'`,

  // Та сама опція, що й у видимих товарів — негативний контроль сторінки
  // значення характеристики.
  `insert into public.product_property_values (product_id, property_id, option_id)
   select p.id, sp.id, po.id
     from public.products p
     join public.section_properties sp on sp.slug = '${PAGED_PROPERTY_SLUG}'
     join public.property_options po
       on po.property_id = sp.id and po.slug = '${PAGED_OPTION_SLUG}'
    where p.slug = '${HIDDEN_PRODUCT_SLUG}'`,

  // Наповнення розділу понад ліміт каруселі: без цього віконний зріз
  // перевірявся б на трьох товарах, тобто не перевірявся б.
  `insert into public.products
     (slug, name, section_id, is_active, is_featured, has_modifications, stock_status, images)
   select 'napovnennya-' || g, 'Наповнення ' || g, s.id, true, false, false, 'in_stock', '[]'::jsonb
     from generate_series(1, ${PER_SECTION_LIMIT}) as g
     cross join public.sections s where s.slug = '${FILLED_SECTION_SLUG}'`,
];
