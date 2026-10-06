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
  'packages/simplycms/src/storefront-routes/server/auth.ts':
    'console.error — лог',
  'packages/simplycms/src/storefront-routes/seo/interceptor.ts':
    'console.error — лог',
  'packages/simplycms/src/plugins/bootstrap.ts': 'console.error — лог',
  // Дзеркало плагінного bootstrap: логи синхронізації рядків `themes` читає
  // розробник магазину в консолі, а не покупець.
  'packages/simplycms/src/themes/bootstrapThemes.ts':
    'console.error/warn — лог',
  // Повідомлення валідатора теми адресовані АВТОРОВІ теми, не покупцю: вони
  // кидаються під час реєстрації модуля й потрапляють у консоль складання.
  'packages/simplycms/src/themes/validateThemeModule.ts':
    'throw new Error — діагностика для автора теми',
  // Той самий валідатор, лише винесений блок форми `views` (контракт v3).
  'packages/simplycms/src/themes/validateThemeViews.ts':
    'throw new Error — діагностика для автора теми',
  // Той самий клас: conformance-kit (контракт v3) кидає помилки АВТОРОВІ
  // теми — про відсутнє DOM-середовище, падіння view чи загублений реквізит.
  // Це вивід гейта в терміналі, а не текст інтерфейсу; JSX у файлі немає.
  'packages/simplycms/src/themes/conformance/assertThemeViewsConformance.ts':
    'throw new Error — діагностика для автора теми',
  // console.warn на невалідному записі fonts — читає автор теми в консолі
  // складання, не покупець (контракт v2.2, Р4).
  'packages/simplycms/src/themes/safeFontStylesheets.ts':
    'console.warn — діагностика для автора теми',
  // Той самий клас діагностики для контуру плагінів (Фаза 3): валідатор і
  // definePlugin кидають на порушенні контракту, порти SDK — на зловживанні
  // межею довіри; usePluginConfig лише попереджає в консоль розробника.
  'packages/simplycms/src/plugins/validatePluginModule.ts':
    'throw + console.warn — діагностика для автора плагіна',
  'packages/simplycms/src/plugin-sdk/definePlugin.ts':
    'throw new Error — діагностика для автора плагіна',
  'packages/simplycms/src/plugin-sdk/usePluginTable.ts':
    'throw new Error — межа довіри (гард plg_)',
  'packages/simplycms/src/plugin-sdk/usePluginConfig.ts': 'console.warn — лог',
  // Серверна половина портів (рішення B9): усі рядки — `throw new Error` на
  // порушенні межі даних плагіна або на невалідному запиті. Їх читає автор
  // плагіна в логах сервера; жоден із них не доходить до покупця — хендлер
  // віддає браузеру помилку, а не її текст як інтерфейс.
  'packages/simplycms/src/plugin-sdk/server/guard.ts':
    'throw new Error — межа даних плагіна',
  'packages/simplycms/src/plugin-sdk/server/table-db.ts':
    'throw new Error — діагностика запиту плагіна',
  'packages/simplycms/src/plugin-sdk/server/index.ts':
    'throw new Error — відмова в записі не-адміну',
  'packages/simplycms/src/admin/lib/pluginSettingsFields.ts':
    'console.warn — діагностика непредставної settings-схеми плагіна',
  // Кореневі дані вітрини (Е6б-10/12): обидва кидають, коли host не віддає
  // профіль магазину. Читає розробник магазину, що зібрав `__root.tsx`, — не
  // покупець: на зібраному магазині ці гілки недосяжні.
  'packages/simplycms/src/storefront-routes/head/head.ts':
    'throw new Error — діагностика host-а (кореневий лоадер)',
  'packages/simplycms/src/themes/store-profile.tsx':
    'throw new Error — діагностика host-а (провайдер профілю)',
};

/**
 * Файли, ще не мігровані. Список лише скорочувався; порожній він означає, що
 * міграцію завершено.
 *
 * Тест падає і на зайвому записі: файл без жодного кириличного рядка тут
 * лишатися не може, інакше реєстр тихо перетворився б на список-вигадку.
 */
export const PENDING_FILES: readonly string[] = [
  // Решта зон порожня: міграцію завершено — вітрина, адмінка, воронка покупки,
  // host, обидві теми і (з Фази 3) плагіни: `plugins/` і референс-пакети
  // `packages/simplycms-plugin-*` в `SCANNED_ROOTS`, каталоги — власні
  // `messages` плагіна (дзеркало тем, спека §12), парність стереже
  // `tests/plugin-messages-parity.test.ts`. Будь-який новий кириличний рядок
  // інтерфейсу в цих зонах валить тест, а не додається сюди.
  //
  // Останній борг — `<title>`/`<meta description>` роутів вітрини (`head()`,
  // внесені сюди 2026-08-21 разом із `packages/simplycms/routes` у
  // `SCANNED_ROOTS`) — закрито рішенням Е6б-10 (К3-Е6б): локаль і назва
  // магазину приходять у `head()` з кореневого лоадера host-а через
  // `matches`, а заголовки будує `storefrontHead`
  // (`simplycms/storefront-routes/head/head`) транслятором тієї локалі.
];
