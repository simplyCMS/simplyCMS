/**
 * Реєстр ключів advisory-замків — ЄДИНЕ місце, де вони оголошені (М1, Task 2).
 *
 * Чому один реєстр. Ключ рядковий замок хешує `hashtextextended(key, 0)` у 64-бітне
 * число, а ключ накату — число напряму (`pg_advisory_lock(bigint)`): простір
 * ключів один на базу. Розкидані по модулях літерали не дають ні переліку, ні
 * доказу, що два ключі не збігаються; реєстр + `lock-keys-disjoint.test.ts`
 * (рядкові ключі попарно різні й не дорівнюють ключу накату) дають обидва.
 *
 * 🔴 Значення НЕ міняти: рядки хешуються так само в хелперах харнеса
 * (`holdAdvisoryLock`), а ключ накату читає `pg_locks` у `migrate-lock.test.ts`.
 * Зміна значення мовчки розвела б замок коду із замком тесту й зі старими
 * реплікам, що ще працюють на попередній збірці. Нові ключі додаються СЮДИ, і
 * тест на непересічність змушує додати їх у список.
 *
 * Модуль без залежностей: його імпортують і `migrate` (власне зʼєднання `pg`,
 * без `withActor`), і шар даних.
 */

/**
 * Ключ сесійного `pg_advisory_lock` накату (ASCII «SCMSMIGR»). Advisory-лок
 * прив'язаний до бази, тож дві репліки однієї бази серіалізуються, а різні
 * бази одного кластера — ні. `BigInt(…)`, а не літерал `n`: ціль компіляції
 * кореня — ES2017.
 */
export const MIGRATION_LOCK_KEY: bigint = BigInt('0x53434D534D494752');

export const LOCK_KEYS = {
  /** Накат міграцій (число, не рядок: інший клас ключів). */
  migration: MIGRATION_LOCK_KEY,
  /**
   * Набір мов. СПІЛЬНИМ його беруть операції, що створюють адреси й токени
   * (сутність, модифікація, опція); ексклюзивним — додавання мови й перехід
   * `disabled` → `published`: пакетне заповнення чекає завершення таких
   * транзакцій і бачить усі закомічені сутності.
   */
  languagesSet: 'languages-set',
  /** Ролі адміна (Е6г-4, Е6г-19): «не останній адмін», бан, видалення, invite. */
  adminRoles: 'admin-roles',
  /** Префікс замка покупця (`customer-category:<userId>`): категорія й бан. */
  customerCategoryPrefix: 'customer-category:',
  /** Конфігурація покупців (Е6в-15): категорії, автоправила, setDefault. */
  customerConfig: 'customer-config',
  /** Конфігурація знижок (Е6в-15): групи, `saveDiscount`, видалення. */
  discountConfig: 'discount-config',
  /** Конфігурація доставки (Е6а-12): способи, зони, точки. */
  shippingConfig: 'shipping-config',
  /** Активна тема сайту (Е6б-15). */
  siteTheme: 'site-theme',
  /** Запис профілю магазину (Е6б). */
  storeProfile: 'store-profile',
  /** Довідник типів цін (Е4-2): setDefault і remove. */
  priceTypeDefault: 'price-type-default',
  /** Ціль залишку: `stock:<productId>:<modificationId>`. */
  stockPrefix: 'stock:',
  /** Ціль цін: `prices:<productId>:<modificationId>`. */
  pricesPrefix: 'prices:',
  /** Дефолтна модифікація товару: `mod-default:<productId>`. */
  modDefaultPrefix: 'mod-default:',
} as const;
