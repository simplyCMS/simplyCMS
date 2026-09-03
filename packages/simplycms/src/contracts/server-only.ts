/**
 * Межа довіри клієнт/сервер ядра — ЄДИНА декларація (трек T, 2026-09-02).
 *
 * Субшлях у списку означає: модуль існує лише на сервері й НІКОЛИ не
 * імпортується клієнтським кодом напряму. serverFn-модулі сюди НЕ входять
 * (`admin-server`, `plugin-sdk/server`, `themes/server`, `plugins/server`,
 * `storefront-routes/server/*`, `core/lib/*`): їх клієнт імпортує легально,
 * а компілятор Start замінює хендлери RPC-стабами і прибирає осиротілі
 * серверні імпорти. Перевірено збіркою хоста 2026-09-02: `plugin-sdk/server`,
 * `themes/server` і `plugins/server` у цьому списку дають пʼять хибних
 * спрацювань Import Protection на чистому коді.
 *
 * 🔴 Тут лише ДАНІ (тір T0 — нуль рантайм-залежностей). Читачів пʼять, кожен
 * своїм механізмом, і жоден не тримає власної копії списку:
 *   1. `packages/simplycms/tsdown.config.ts` — серверна група збірки;
 *   2. `tests/dist-server-boundary.test.ts` — партиція `dist` (packaging-suite);
 *   3. `eslint.config.mjs` + `eslint-rules/server-only-relative.mjs` — межа
 *      для плагінів і заборона відносного імпорту в server-only дерево;
 *   4. `scripts/pilot-pack/gate-c.mjs` — серверний вантаж у клієнтських чанках;
 *   5. `vite.config.ts` хоста, шаблону й пілота — Import Protection Start.
 *
 * Legacy `supabase/*` навмисно НЕ тут: `supabase/keys` легально спільний для
 * anon- і browser-клієнта; Gate C тримає ці два файли літералами до К3.
 */
export const SERVER_ONLY = [
  'db',
  'auth',
  'schema',
  'storefront',
  // Побудова sitemap/robots і перехоплювач SEO-запитів: їх кличе лише
  // серверний entry магазину (`src/server.ts`), `sitemap` тягне лоадери.
  'storefront-routes/seo',
  // Після Task 1 Крок 1а — ЦІЛЕ піддерево нутрощів адмінки (index + resource +
  // operations + resources + subset); стаб `admin-server/index` — клієнт.
  'admin-server/impl',
] as const;

/**
 * Зовнішні залежності, що існують лише на сервері.
 *
 * `clientSafe` — підшляхи пакета, які клієнту МОЖНА: виняток описується
 * даними тут, а не спецвипадком у котромусь читачі, інакше кожен читач знав
 * би про межу своє.
 */
export const SERVER_ONLY_DEPS = [
  { name: 'pg' },
  { name: 'drizzle-orm' },
  { name: 'drizzle-zod' },
  // Корінь better-auth — сервер; `better-auth/react` — клієнтський SDK.
  { name: 'better-auth', clientSafe: ['react'] },
] as const;

/** Патерн специфікатора однієї серверної залежності (з урахуванням `clientSafe`). */
export const serverOnlyDepSpecifier = (dep: {
  readonly name: string;
  readonly clientSafe?: readonly string[];
}): RegExp =>
  new RegExp(
    dep.clientSafe?.length
      ? `^${dep.name}(/(?!(?:${dep.clientSafe.join('|')})(?:/|$))|$)`
      : `^${dep.name}(/|$)`,
  );

/** Префікс декларації, під яким лежить субшлях (без `simplycms/`), або null. */
export const serverOnlyOwner = (subpath: string): string | null =>
  SERVER_ONLY.find((p) => subpath === p || subpath.startsWith(`${p}/`)) ?? null;

export const isServerOnlySubpath = (subpath: string): boolean =>
  serverOnlyOwner(subpath) !== null;

const alternation = SERVER_ONLY.join('|');

/**
 * Патерни для Import Protection (Vite-плагін Start), клієнтське середовище.
 *
 * `specifiers` ловлять bare-імпорт у магазині (там alias-ів немає); `files` —
 * резолвлений шлях, бо в монорепо alias `simplycms/*` спрацьовує РАНІШЕ за
 * перевірку і специфікатор до неї не доходить (виміряно 2026-09-02: без
 * `files` витік `simplycms/db` у роут хоста збирався зеленим).
 */
export const serverOnlySpecifiers = (): RegExp[] => [
  new RegExp(`^simplycms/(${alternation})(/|$)`),
  ...SERVER_ONLY_DEPS.map(serverOnlyDepSpecifier),
];

/**
 * 🔴 `simplycms/(src|dist)`, а не `packages/simplycms/src`: та сама форма
 * покриває монорепо (`packages/simplycms/src/...`) і магазин
 * (`node_modules/simplycms/src/...` — `src` їде в tarball разом із `dist`).
 * Сторонніх `simplycms-*` це не чіпає: між іменем і `/src` у них дефіс.
 */
export const serverOnlyFiles = (): RegExp[] => [
  new RegExp(`simplycms/(src|dist)/(${alternation})(/|\\.[tj]sx?$)`),
];

/**
 * Ціль, яку file-deny НЕ перевіряє (Import Protection, клієнт).
 *
 * 🔴 Дефолт Start виключає з file-deny увесь `node_modules` (глоб `**`
 * перед `/node_modules/` і після), а користувацьке значення дефолт
 * ЗАМІЩУЄ, а не доповнює (`pick(user, default)`). З дефолтом file-deny у
 * магазині мертвий рівно там, де живе ядро, — тож сторонній плагін або тема
 * (у них `simplycms` у залежностях, і pnpm кладе симлінк на ядро ПОРУЧ)
 * обходить `specifiers` одним відносним шляхом у `simplycms/src/**`, і наш
 * лінт цього коду не бачить ніколи. Виключаємо все в node_modules, КРІМ
 * самого пакета ядра.
 *
 * Lookahead на початку рядка, бо в pnpm реальний шлях —
 * `node_modules/.pnpm/simplycms@x/node_modules/simplycms/src/…`. Слеш у
 * `simplycms/` обовʼязковий: `simplycms-theme-*` лишаються виключеними — їхні
 * файли не є нашими server-only деревами, а їхній bare `simplycms/db` ловлять
 * `specifiers`.
 */
export const serverOnlyExcludeFiles = (): RegExp[] => [
  /^(?!.*node_modules\/simplycms\/).*node_modules\//,
];
