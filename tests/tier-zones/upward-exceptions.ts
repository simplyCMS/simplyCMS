/**
 * Знімок upward-винятків тір-зон (`eslint.tier-zones.mjs`): ключ — `зона→дозволена тека`
 * (для зон без субшляху — тека зони; файл-виняток — `теку/файл`), значення — ПРИЧИНА.
 * Новий виняток без запису тут і запис без винятку в зоні червонять
 * `tests/tier-zones-upward.test.ts`: підняти імпорт угору по шарах — архітектурне рішення,
 * а не побічний ефект правки. Причина обов'язкова й непорожня. Модель — `doc-symbols-exist/data.ts`.
 */
export const UPWARD_EXCEPTIONS: Readonly<Record<string, string>> = {
  // --- auth (T2) ---
  'auth→db':
    'єдиний канал до Postgres — withActor; без нього auth пішов би на голий пул',
  'auth→mail':
    'auth кличе пошту (outbox і рендер листів), зворотних імпортів немає (Е8-Т11)',
  'auth→site': 'читає назву магазину й локаль для листів (Е8-Т11)',
  'auth→i18n': 'тексти листів auth (Е8-Т11)',
  'auth→env': 'база посилань siteUrl у листах (Е8-Т11)',
  // --- runtime / storefront / admin-server ---
  'runtime→i18n': 'RouterContext.locales типізується LocaleSet (type-only)',
  'storefront→db': 'єдиний канал до Postgres — withActor (лоадери вітрини)',
  'storefront→auth':
    'читання сесії для лоадерів, userId лише з серверної сесії',
  'storefront→storage':
    'єдиний канал до файлів (аватар); ратчет tests/storage-port-consumers.test.ts',
  'storefront→inventory':
    'спільний гвард залишків (оформлення й скасування замовлення)',
  'storefront→commerce':
    'серверне ціноутворення й доставка — одна копія рушія з адмінкою (Е5б-5)',
  'storefront→sanitize': 'санітизація rich-HTML у лоадерах (Тема 9)',
  'storefront→site': 'кеш профілю магазину й активної теми (Е6б-7)',
  'storefront→mail':
    'лист замовлення ставиться в outbox у транзакції оформлення (Е8, Task 12)',
  'storefront→env': 'база посилань у листі — лише siteUrl (Е8, Р18в)',
  'storefront→i18n': 'тексти листа замовлення (Е8, Task 12)',
  'admin-server→db': 'єдиний канал до Postgres — withActor (Е1б)',
  'admin-server→auth': 'перший рубіж requireGrant/requireOperation (Е1б)',
  'admin-server→storage':
    'єдиний канал до файлів — порт (Е2); заборона виштовхнула б адмінку на node:fs',
  'admin-server→inventory': 'спільний гвард залишків (Е3-5)',
  'admin-server→commerce':
    'ціноутворення й доставка для редагування позицій замовлення (Е5б-5)',
  'admin-server→sanitize': 'санітизація rich-HTML при записі описів',
  'admin-server→site':
    'операції адмінки піднімають покоління кешу профілю й теми в транзакції (Е6б-7, Д6)',
  'admin-server→mail':
    'картка хвостів пошти читає/повторює outbox (Е8, Task 12)',
  'admin-server→operations':
    'операції мов і токенів — споживачі defineOperation/виконавця (М1, Task 6)',
  'admin-server→addressing':
    'fill мови кличе copyPathsForLocale/copyTokensForLocale (М1, Task 6)',
  // --- T2 інфраструктура ---
  'storage→db':
    'рядок media пишеться через withActor — іншого каналу до Postgres немає',
  'storage→env':
    'вибір драйвера за групами S3_*/MEDIA_ROOT — чиста resolveDriverEnv (Е8-Р7)',
  'inventory→db': 'гвард пише через ActorDb (Е3-5)',
  'commerce→db': 'рушій читає прайси/знижки/тарифи через ActorDb (Е5б-5)',
  'site→db':
    'тип ActorDb; власного каналу до Postgres модуль не відкриває (Е6б-7)',
  'site→i18n': 'тип Locale для декларації локалі магазину',
  'server-guard→env': 'прод-предикат і redactUrls беруться з env (Е8, Р23/Р27)',
  'mail→env': 'вибір драйвера за групою SMTP_* і прод-предикат (Е8, Task 9)',
  'mail→db': 'запис outbox mail_outbox лише через withActor (Task 10)',
  'mail→schema': 'таблиця mail_outbox (Task 10)',
  'mail→i18n': 'тексти листів',
  'migrate→db/lock-keys':
    'чисті константи реєстру ключів замків без імпортів: ключ накату живе в одному реєстрі, withActor лишається забороненим (М1, Task 2)',
  'prod-start→env': 'перевірка груп env до накату (К3-Е8, F5)',
  'prod-start→migrate': 'сам накат міграцій на старті (К3-Е8)',
  'addressing→db': 'транзакція викликача і замок набору мов (М1, Task 5)',
  'operations→db': 'єдиний канал withActor для виконавця операцій (М1, Task 6)',
  'operations→auth':
    "перший рубіж requireOperation і суб'єкт з cookie (М1, Task 6)",
  // --- T4 / T5 ---
  'plugin-sdk→plugins':
    'README називає plugin-sdk T2, але він імпортує plugins (T4): факт, не бажана архітектура',
  'catalog-ui→core':
    'legacy-фасад core: зустрічний цикл *-ui ↔ core, борг розселення поза К0',
  'checkout-ui→core':
    'legacy-фасад core: зустрічний цикл *-ui ↔ core, борг розселення поза К0',
  'profile-ui→core':
    'legacy-фасад core: зустрічний цикл *-ui ↔ core, борг розселення поза К0',
  'reviews-ui→core':
    'legacy-фасад core: зустрічний цикл *-ui ↔ core, борг розселення поза К0',
  'admin→core': 'legacy-фасад core (T5 поруч з admin), статус-кво зон К0',
  'storefront-routes→core': 'legacy-фасад core (T5 поруч), статус-кво зон К0',
  'routes/storefront→storefront-routes':
    'роут-файли — тонкі обгортки над сторінками (T5 → T5)',
  'routes/admin→admin':
    'роут-файли адмінки — тонкі обгортки над сторінками (T5 → T5)',
  'routes/admin→storefront-routes':
    'адмінські роути ділять з вітриною auth-сторінки та обгортки',
};
