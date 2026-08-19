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
  // Дзеркало плагінного bootstrap: логи синхронізації рядків `themes` читає
  // розробник магазину в консолі, а не покупець.
  'packages/theme-system/src/bootstrapThemes.ts': 'console.error/warn — лог',
  // Повідомлення валідатора теми адресовані АВТОРОВІ теми, не покупцю: вони
  // кидаються під час реєстрації модуля й потрапляють у консоль складання.
  'packages/theme-system/src/validateThemeModule.ts':
    'throw new Error — діагностика для автора теми',
  // Той самий валідатор, лише винесений блок форми `views` (контракт v3).
  'packages/theme-system/src/validateThemeViews.ts':
    'throw new Error — діагностика для автора теми',
  // Той самий клас: conformance-kit (контракт v3) кидає помилки АВТОРОВІ
  // теми — про відсутнє DOM-середовище, падіння view чи загублений реквізит.
  // Це вивід гейта в терміналі, а не текст інтерфейсу; JSX у файлі немає.
  'packages/theme-system/src/conformance/assertThemeViewsConformance.ts':
    'throw new Error — діагностика для автора теми',
  // console.warn на невалідному записі fonts — читає автор теми в консолі
  // складання, не покупець (контракт v2.2, Р4).
  'packages/theme-system/src/safeFontStylesheets.ts':
    'console.warn — діагностика для автора теми',
  // Той самий клас діагностики для контуру плагінів (Фаза 3): валідатор і
  // definePlugin кидають на порушенні контракту, порти SDK — на зловживанні
  // межею довіри; usePluginConfig лише попереджає в консоль розробника.
  'packages/plugin-system/src/validatePluginModule.ts':
    'throw + console.warn — діагностика для автора плагіна',
  'packages/plugin-sdk/src/definePlugin.ts':
    'throw new Error — діагностика для автора плагіна',
  'packages/plugin-sdk/src/usePluginTable.ts':
    'throw new Error — межа довіри (гард plg_)',
  'packages/plugin-sdk/src/usePluginConfig.ts': 'console.warn — лог',
  'packages/admin/src/lib/pluginSettingsFields.ts':
    'console.warn — діагностика непредставної settings-схеми плагіна',
};

/**
 * Файли, ще не мігровані. Список лише скорочувався; порожній він означає, що
 * міграцію завершено.
 *
 * Тест падає і на зайвому записі: файл без жодного кириличного рядка тут
 * лишатися не може, інакше реєстр тихо перетворився б на список-вигадку.
 */
export const PENDING_FILES: readonly string[] = [
  // Порожньо: міграцію завершено — вітрина, адмінка, воронка покупки, host,
  // обидві теми і (з Фази 3) плагіни: `plugins/` і референс-пакети
  // `packages/simplycms-plugin-*` в `SCANNED_ROOTS`, каталоги — власні
  // `messages` плагіна (дзеркало тем, спека §12), парність стереже
  // `tests/plugin-messages-parity.test.ts`. Будь-який новий кириличний рядок
  // інтерфейсу в зонах `SCANNED_ROOTS` валить тест, а не додається сюди.
];
