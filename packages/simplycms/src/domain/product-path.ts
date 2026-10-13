// simplycms/domain — єдиний канонічний шлях картки товару (К3-Е8, Р25).
//
// 🔴 Раніше кожен споживач будував URL по-своєму (картка — порожній сегмент,
// sitemap — `products`, адмінка — `all`, canonical — сегмент із URL запиту),
// тож товар без розділу (FK `on delete set null` робить його легальним) давав
// `/catalog//slug` → 404 і кілька canonical. Тепер шлях будує ЛИШЕ ця функція.

/**
 * Сегмент `/catalog/<сегмент>/<slug>` для товару без розділу. Зарезервований:
 * slug розділу не може його зайняти (форма й сервер відхиляють), інакше
 * розділ `all` перехопив би шлях безрозділових товарів.
 */
export const NO_SECTION_SLUG = 'all';

/** Чи зарезервований slug (його не може мати розділ). */
export function isReservedSectionSlug(slug: string): boolean {
  return slug === NO_SECTION_SLUG;
}

/** Мінімум товару, з якого видно його шлях. */
export type ProductPathInput = {
  slug: string;
  sectionSlug: string | null | undefined;
};

/** Шлях роуту картки (патерн TanStack Router) — для `Link`. */
export const PRODUCT_ROUTE = '/catalog/$sectionSlug/$productSlug' as const;

export type ProductPath = {
  /** Патерн роуту для `<Link to>`. */
  to: typeof PRODUCT_ROUTE;
  params: { sectionSlug: string; productSlug: string };
  /** Готовий шлях для sitemap, адмінки, canonical і JSON-LD. */
  href: string;
};

/** Канонічний шлях товару: з розділом — його slug, без — `NO_SECTION_SLUG`. */
export function productPath(product: ProductPathInput): ProductPath {
  const sectionSlug = product.sectionSlug || NO_SECTION_SLUG;
  return {
    to: PRODUCT_ROUTE,
    params: { sectionSlug, productSlug: product.slug },
    href: `/catalog/${sectionSlug}/${product.slug}`,
  };
}

/**
 * Куди слати запит `/catalog/<segment>/<slug>`: `null`, якщо сегмент уже
 * канонічний, інакше `{ to, params }` для 301. Чиста функція, щоб рішення
 * роуту тестувалося без роутера.
 */
export function productRedirectTarget(
  product: ProductPathInput,
  segment: string,
): Pick<ProductPath, 'to' | 'params'> | null {
  const { to, params } = productPath(product);
  return params.sectionSlug === segment ? null : { to, params };
}
