// Фікстури контуру вітрини поверх демо-сіду (В2-К1а).
//
// 🔴 Демо-сід навмисно НЕ містить нічого прихованого — він показує магазин.
// Негативний контроль фільтрів видимості тому доводиться дописувати тут:
// без жодного неактивного рядка тест «не віддає неактивні» був би зеленим
// на порожній множині, тобто не доводив би нічого.

import { randomUUID } from 'node:crypto';
import { productGraphSql, sqlRef } from './product-graph';

const sectionBySlug = (slug: string) =>
  sqlRef(`(select id from public.sections where slug = '${slug}')`);

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

  `insert into public.sections (id, slug, name, sort_order, is_active)
     values (gen_random_uuid(), '${HIDDEN_SECTION_SLUG}', 'Прихований розділ', 99, false)`,

  // Чернетка: неактивна, але «популярна» й у активному розділі — тобто
  // потрапила б у КОЖНУ добірку, якби фільтр видимості загубився. Має ту саму
  // опцію, що й видимі товари — негативний контроль сторінки значення
  // характеристики.
  productGraphSql({
    id: randomUUID(),
    slug: HIDDEN_PRODUCT_SLUG,
    name: 'Чернетка товару',
    sectionId: sectionBySlug('sonyachni-paneli'),
    isActive: false,
    isFeatured: true,
    hasModifications: false,
    stockStatus: 'in_stock',
    values: [
      {
        id: randomUUID(),
        propertyId: sqlRef(
          `(select id from public.section_properties where slug = '${PAGED_PROPERTY_SLUG}')`,
        ),
        kind: 'select',
        optionId: sqlRef(
          `(select po.id from public.property_options po
              join public.section_properties sp on sp.id = po.property_id
             where sp.slug = '${PAGED_PROPERTY_SLUG}' and po.slug = '${PAGED_OPTION_SLUG}')`,
        ),
      },
    ],
  }),

  // Наповнення розділу понад ліміт каруселі: без цього віконний зріз
  // перевірявся б на трьох товарах, тобто не перевірявся б.
  ...Array.from({ length: PER_SECTION_LIMIT }, (_, i) =>
    productGraphSql({
      id: randomUUID(),
      slug: `napovnennya-${i + 1}`,
      name: `Наповнення ${i + 1}`,
      sectionId: sectionBySlug(FILLED_SECTION_SLUG),
      isActive: true,
      isFeatured: false,
      hasModifications: false,
      stockStatus: 'in_stock',
    }),
  ),
];
