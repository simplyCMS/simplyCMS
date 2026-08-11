/**
 * Реєстр i18n-міграції: що ще не переведено і що переводити не треба.
 *
 * 🔴 Навіщо це поверх ESLint. Селектори `no-restricted-syntax` бачать лише
 * `JSXText` і атрибути `placeholder|title|aria-*`, тобто ~64 % роботи: toast,
 * повідомлення Zod, тернарники, мапи ярликів і рядки в обʼєктах їм не видні.
 * Зелений лінт тому НЕ доводить завершеність міграції — доводить цей файл,
 * зведений до порожнього `PENDING_FILES`.
 */

/**
 * Рядки, що не є інтерфейсом і лишаються українськими навмисно.
 *
 * 🔴 Критерій один: текст читає той, хто тримає термінал або пише тему/плагін,
 * а не покупець. Правило проєкту вимагає української саме для документації й
 * діагностики. Файл у цьому списку НЕ звільняється від перевірки цілком —
 * тест окремо асертить, що кожен його кириличний рядок стоїть усередині
 * `console.*` або `throw new Error(...)` (див. `i18n-coverage.test.ts`).
 */
export const ALLOWLIST: Record<string, string> = {
  // Логи сервера: дивиться розробник у терміналі.
  'packages/storefront-routes/src/server/auth.ts': 'console.error — лог',
  'packages/storefront-routes/src/server/themes.ts': 'console.error — лог',
  'packages/storefront-routes/src/seo/interceptor.ts': 'console.error — лог',
  'packages/storefront/src/loaders/pricing.ts': 'console.error — лог',
  'packages/storefront/src/loaders/products.ts': 'console.error — лог',
  'packages/storefront/src/loaders/properties.ts': 'console.error — лог',
  'packages/storefront/src/loaders/sections.ts': 'console.error — лог',
  'packages/storefront/src/seo/sitemap.ts': 'throw — діагностика генерації',
  'packages/plugin-system/src/bootstrap.ts': 'console.error — лог',
  'packages/theme-system/src/getActiveThemeSSR.ts': 'console.error — лог',
  // Повідомлення валідатора теми адресовані АВТОРОВІ теми, не покупцю: вони
  // кидаються під час реєстрації модуля й потрапляють у консоль складання.
  'packages/theme-system/src/validateThemeModule.ts':
    'throw new Error — діагностика для автора теми',
};

/**
 * Файли, ще не мігровані. Список лише скорочувався; порожній він означає, що
 * міграцію завершено.
 *
 * Тест падає і на зайвому записі: файл без жодного кириличного рядка тут
 * лишатися не може, інакше реєстр тихо перетворився б на список-вигадку.
 */
export const PENDING_FILES: readonly string[] = [
  // Порожньо: міграцію завершено — вітрина, адмінка, воронка покупки, host і
  // обидві теми. Будь-який новий кириличний рядок інтерфейсу в зонах
  // `SCANNED_ROOTS` тепер валить тест, а не додається сюди.
  //
  // 🔴 Що НЕ покрито й чому: `plugins/hello-world` (2 рядки — маніфест і текст
  // віджета). Плагіни, як і теми, мають отримати ВЛАСНІ каталоги
  // (спека платформи §12); механізм зроблено для тем (`ThemeModule.messages`),
  // на плагіни його ще не поширено. Додавати плагінні рядки в core-каталог
  // було б тим самим порушенням шару, якого ми уникли для тем.
];
