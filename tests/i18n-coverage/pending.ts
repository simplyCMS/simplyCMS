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
 * Вид діагностики, дозволений для файлу. Точковість важлива: файл із записом
 * `throw` не може заховати кириличний `super('…')` чи лог-рядок — кожен вид
 * перевіряється окремо в `i18n-coverage.test.ts`.
 */
export type DevKind = 'console' | 'throw' | 'super' | 'log-sink';
export type AllowEntry = {
  kind: DevKind | DevKind[];
  reason: string;
  /**
   * Точна кількість дозволених кириличних рядків у файлі. Звужує виняток із
   * «увесь файл» до «рівно ці рядки»: новий рядок (скажімо, текст для покупця
   * у CLI-файлі) змінює кількість, червонить тест і вимагає свідомо
   * переглянути запис, а не проходить повз під існуючим винятком.
   */
  strings?: number;
};

/**
 * Рядки, що не є інтерфейсом і лишаються українськими навмисно.
 *
 * 🔴 Критерій один: текст читає той, хто тримає термінал або пише тему/плагін,
 * а не покупець. Правило проєкту вимагає української саме для документації й
 * діагностики. Файл у цьому списку НЕ звільняється від перевірки цілком —
 * тест окремо асертить, що кожен його кириличний рядок стоїть усередині
 * `console.*` або `throw new Error(...)` (див. `i18n-coverage.test.ts`).
 */
// Кількість кириличних рядків CLI `owner:invite` (див. `AllowEntry.strings`).
const RUN_STRINGS = 11;
const CLI_STRINGS = 3;

export const ALLOWLIST: Record<string, AllowEntry> = {
  // Логи сервера: дивиться розробник у терміналі.
  'packages/simplycms/src/storefront-routes/seo/interceptor.ts': {
    kind: 'console',
    reason: 'console.error — лог',
  },
  'packages/simplycms/src/plugins/bootstrap.ts': {
    kind: 'console',
    reason: 'console.error — лог',
  },
  // Дзеркало плагінного bootstrap: логи синхронізації рядків `themes` читає
  // розробник магазину в консолі, а не покупець.
  'packages/simplycms/src/themes/bootstrapThemes.ts': {
    kind: 'console',
    reason: 'console.error/warn — лог',
  },
  // Повідомлення валідатора теми адресовані АВТОРОВІ теми, не покупцю: вони
  // кидаються під час реєстрації модуля й потрапляють у консоль складання.
  'packages/simplycms/src/themes/validateThemeModule.ts': {
    kind: ['throw', 'console'],
    reason: 'throw new Error — діагностика для автора теми',
  },
  // Той самий валідатор, лише винесений блок форми `views` (контракт v3).
  'packages/simplycms/src/themes/validateThemeViews.ts': {
    kind: 'throw',
    reason: 'throw new Error — діагностика для автора теми',
  },
  // Той самий клас: conformance-kit (контракт v3) кидає помилки АВТОРОВІ
  // теми — про відсутнє DOM-середовище, падіння view чи загублений реквізит.
  // Це вивід гейта в терміналі, а не текст інтерфейсу; JSX у файлі немає.
  'packages/simplycms/src/themes/conformance/assertThemeViewsConformance.ts': {
    kind: 'throw',
    reason: 'throw new Error — діагностика для автора теми',
  },
  // console.warn на невалідному записі fonts — читає автор теми в консолі
  // складання, не покупець (контракт v2.2, Р4).
  'packages/simplycms/src/themes/safeFontStylesheets.ts': {
    kind: 'console',
    reason: 'console.warn — діагностика для автора теми',
  },
  // Той самий клас діагностики для контуру плагінів (Фаза 3): валідатор і
  // definePlugin кидають на порушенні контракту, порти SDK — на зловживанні
  // межею довіри; usePluginConfig лише попереджає в консоль розробника.
  'packages/simplycms/src/plugins/validatePluginModule.ts': {
    kind: ['console', 'throw'],
    reason: 'throw + console.warn — діагностика для автора плагіна',
  },
  'packages/simplycms/src/plugin-sdk/definePlugin.ts': {
    kind: 'throw',
    reason: 'throw new Error — діагностика для автора плагіна',
  },
  'packages/simplycms/src/plugin-sdk/usePluginConfig.ts': {
    kind: 'console',
    reason: 'console.warn — лог',
  },
  // Серверна половина портів (рішення B9): усі рядки — `throw new Error` на
  // порушенні межі даних плагіна або на невалідному запиті. Їх читає автор
  // плагіна в логах сервера; жоден із них не доходить до покупця — хендлер
  // віддає браузеру помилку, а не її текст як інтерфейс.
  'packages/simplycms/src/plugin-sdk/server/guard.ts': {
    kind: 'throw',
    reason: 'throw new Error — межа даних плагіна',
  },
  'packages/simplycms/src/plugin-sdk/server/table-db.ts': {
    kind: 'throw',
    reason: 'throw new Error — діагностика запиту плагіна',
  },
  'packages/simplycms/src/plugin-sdk/server/index.ts': {
    kind: 'throw',
    reason: 'throw new Error — відмова в записі не-адміну',
  },
  'packages/simplycms/src/admin/lib/pluginSettingsFields.ts': {
    kind: 'console',
    reason: 'console.warn — діагностика непредставної settings-схеми плагіна',
  },
  // Кореневі дані вітрини (Е6б-10/12): обидва кидають, коли host не віддає
  // профіль магазину. Читає розробник магазину, що зібрав `__root.tsx`, — не
  // покупець: на зібраному магазині ці гілки недосяжні.
  'packages/simplycms/src/storefront-routes/head/head.ts': {
    kind: 'throw',
    reason: 'throw new Error — діагностика host-а (кореневий лоадер)',
  },
  'packages/simplycms/src/themes/store-profile.tsx': {
    kind: 'throw',
    reason: 'throw new Error — діагностика host-а (провайдер профілю)',
  },
  // Е8-Т11: auth і пошта у SCANNED_ROOTS. Усе нижче — діагностика оператора
  // (помилки env, лог-рядки), не текст для покупця; листи — лише з `mail.*`.
  'packages/simplycms/src/auth/auth-env.ts': {
    kind: 'throw',
    reason: 'throw new Error — діагностика env',
  },
  'packages/simplycms/src/auth/authz.ts': {
    kind: 'super',
    reason: 'super(...) помилки — клієнт читає name/operation, не message',
  },
  'packages/simplycms/src/auth/mail-support.ts': {
    kind: 'console',
    reason: 'console.warn — лог доставки',
  },
  'packages/simplycms/src/auth/invite.ts': {
    kind: 'super',
    reason: 'super(...) помилки — діагностика',
  },
  // `owner:invite` (F5 рев'ю Е8: логіка переїхала з файлів магазину в ядро):
  // вивід CLI власнику магазину в терміналі — лог-синк і відмови помилкою, не
  // текст для покупця; сам лист запрошення — лише з каталогу `mail.*`.
  'packages/simplycms/src/auth/owner-invite-cli/run.ts': {
    kind: ['throw', 'log-sink'],
    reason: 'вивід CLI owner:invite оператору (log і throw), не інтерфейс',
    strings: RUN_STRINGS,
  },
  'packages/simplycms/src/auth/owner-invite-cli/cli.ts': {
    kind: ['throw', 'log-sink'],
    reason: 'вивід CLI owner:invite оператору (log і throw), не інтерфейс',
    strings: CLI_STRINGS,
  },
  'packages/simplycms/src/mail/log.ts': {
    kind: 'log-sink',
    reason: 'лог-драйвер: рядок для оператора в лозі процесу',
  },
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
