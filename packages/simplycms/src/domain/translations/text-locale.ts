/**
 * Форма коду мови (BCP 47) — та сама, що CHECK `languages_code_format` у схемі. Недовірений
 * вхід (`locale` серверної функції) звіряється з нею й обмежений довжиною ДО походу в набір мов.
 */
export const LANGUAGE_CODE_FORMAT = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/;

/**
 * Мова, якою читається ТЕКСТ товару (назва, адреса, короткий опис), разом з основною
 * мовою магазину: читач бере текст `locale`, а де його немає — основної (fallback, М1).
 *
 * Окремий тип, а не два рядки в сигнатурах: `locale` і `primary` завжди їдуть парою, і
 * переплутати їх місцями (обидва — `string`) було б мовчазним дефектом.
 */
export interface TextLocale {
  /** Мова запиту (опублікована; невідому викликач уже звів до основної). */
  readonly locale: string;
  /** Основна мова магазину: джерело fallback і мова адмінських читань. */
  readonly primary: string;
  /**
   * Бренд «мову перевірено»: літерал `{ locale, primary }` не компілюється, а `loadCatalog`,
   * `priceCart`, `priceItems` і читальні лоадери беруть лише значення, яке виробила межа
   * (`checkedTextLocale`). Властивість лише типова — у рантаймі її немає.
   */
  readonly __checked: true;
}

/**
 * Єдиний конструктор `TextLocale`. Викликають ЛИШЕ межі, що самі перевірили мову:
 * `resolveTextLocale` (опублікована або основна), `requirePublishedTextLocale` (оформлення) і
 * адмін-читачі, для яких мова — основна за визначенням. Решта коду значення лише передає.
 */
export function checkedTextLocale(locale: string, primary: string): TextLocale {
  return { locale, primary } as TextLocale;
}
