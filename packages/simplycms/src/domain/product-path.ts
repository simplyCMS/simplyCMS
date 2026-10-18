// simplycms/domain — єдиний канонічний шлях картки товару (М1, §3.2).
//
// Адреса товару — `/<path>` в основній мові й `/<lower(code)>/<path>` в інших;
// `path` бере з реєстру `url_paths` (мова × шлях), а НЕ зі slug-а розділу чи
// товару. Тип сутності за адресою визначає реєстр, не форма URL.

/** Шлях роуту сторінки сутності (один сегмент) — для `<Link to>`. */
export const PRODUCT_ROUTE = '/$path' as const;

/** Мінімум, з якого видно шлях товару. */
export type ProductPathInput = {
  /** Поточна адреса товару в мові `locale`, без префікса мови й початкового `/`. */
  path: string;
  /**
   * Мова адреси. Разом з `primary` лише визначає префікс у `href`. Обидва
   * опущені — адреса основної мови (адмінка, лист: мови читача там нема).
   */
  locale?: string;
  /** Основна мова магазину: її адреси — без префікса. */
  primary?: string;
};

export type ProductPath = {
  /** Патерн роуту для `<Link to>`. */
  to: typeof PRODUCT_ROUTE;
  /**
   * Параметри `<Link>`: БЕЗ мови. Префікс мови дописує `rewrite` роутера за
   * мовою поточної сторінки, тож посилання ведуть на ту саму мову, де стоїть читач.
   */
  params: { path: string };
  /** Готовий шлях від кореня з префіксом мови для canonical, sitemap і JSON-LD. */
  href: string;
};

/**
 * Сегмент префікса мови в URL — `lower(code)` (§3.2). ЄДИНЕ місце правила: розбір префікса
 * (`localePrefix`), hreflang/canonical/sitemap (`localizedPath`) і посилання на товар
 * (`productPath`) кличуть його, тож зміна правила не розведе їх.
 */
export function localePrefixSegment(code: string): string {
  return code.toLowerCase();
}

/**
 * Шлях від кореня мовою `code`: основна — без префікса, інші — `/<lower(code)>/…`; порожній
 * `path` — корінь мови (`/` або `/en`).
 */
export function localizedPath(
  code: string,
  primary: string,
  path: string,
): string {
  if (code === primary) return `/${path}`;
  const prefix = `/${localePrefixSegment(code)}`;
  return path === '' ? prefix : `${prefix}/${path}`;
}

/** Канонічний шлях товару в мові `locale`. */
export function productPath(product: ProductPathInput): ProductPath {
  const { path, locale, primary } = product;
  return {
    to: PRODUCT_ROUTE,
    params: { path },
    href:
      locale === undefined
        ? `/${path}`
        : localizedPath(locale, primary ?? '', path),
  };
}
