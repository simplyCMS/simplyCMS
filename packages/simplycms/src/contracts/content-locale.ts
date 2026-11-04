/**
 * Брендований тип «мова КОНТЕНТУ» — та, якою читається й пишеться вміст магазину
 * (товари, сторінки, URL). Окремий бренд від мови інтерфейсу (спека §19.2): обидві були
 * `string`, і одну можна було мовчки подати замість іншої.
 *
 * 🔴 Створює значення ЛИШЕ `checkedContentLocale` (`simplycms/domain/translations`, поруч
 * із `LANGUAGE_CODE_FORMAT`). Приведення `as ContentLocale` поза ним заборонене. Цей файл —
 * T0 без рантайму: бренд — `declare const`, у бандл нічого не йде.
 */
declare const contentLocaleBrand: unique symbol;

export type ContentLocale = string & { readonly [contentLocaleBrand]: true };

/**
 * Набір мов магазину в розрізі запиту. Єдина форма для сервера (кеш мов з
 * поколіннями), клієнта (`window.__SCMS_LOCALES__`) і розбору URL.
 *
 * `published` містить і основну (вона завжди опублікована); `known` — усі мови
 * в БД, зокрема чернетки й вимкнені: лише так сервер відрізняє «мову, якої
 * немає» (сегмент — звичайний шлях) від «мови, що ще не опублікована» (404).
 */
export type LocaleSet = {
  readonly primary: ContentLocale;
  readonly published: readonly ContentLocale[];
  readonly known: readonly ContentLocale[];
};
