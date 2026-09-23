import type { tanstackStart } from '@tanstack/react-start/plugin/vite';

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
 * 🔴 Тут лише ДАНІ (тір T0 — нуль рантайм-залежностей). Читачів СІМ, кожен
 * своїм механізмом, і жоден не тримає власної копії списку:
 *   1. `packages/simplycms/tsdown.config.ts` — серверна група збірки;
 *   2. `tests/dist-server-boundary.test.ts` — партиція `dist` (packaging-suite);
 *   3. `eslint-rules/server-only-relative.mjs` — заборона ВІДНОСНОГО імпорту
 *      в server-only дерево ззовні нього;
 *   4. групи `no-restricted-imports` в `eslint.config.mjs` — межа довіри
 *      плагінів (bare-специфікатори);
 *   5. `scripts/pilot-pack/gate-c.mjs` — серверний вантаж у клієнтських чанках;
 *   6. `vite.config.ts` хоста, шаблону й пілота — Import Protection Start;
 *   7. `eslint-rules/no-server-only-in-client.mjs` (зона
 *      `simplycms-client-boundary`, К3-Е2) — клієнтські теки ядра (`admin`,
 *      пʼять `*-ui`) не імпортують server-only субшлях чи серверну
 *      залежність. НЕ група в тір-зоні: базовий `no-restricted-imports` не
 *      розрізняє `import` і `import type` (`allowTypeImports` є лише в
 *      typescript-eslint-версії правила, якої в жодній із 26 зон репо
 *      немає), а `import type` стирається компілятором і в бандл не
 *      потрапляє — заборона на нього зламала б живий канон
 *      `admin/pages/OrderStatuses.tsx:8`.
 *
 * 🔴 Пункти 3, 4 і 7 рахуються ОКРЕМО навмисно: це три різні детектори з
 * різними негативними контролями (`tests/eslint-rules/server-only-relative.test.ts`,
 * `tests/plugin-trust-boundary.test.ts`,
 * `tests/eslint-rules/no-server-only-in-client.test.ts` +
 * `tests/tier-boundary-client-boundary.test.ts`), а не «лінт» одним рядком —
 * саме так їх перелічує таблиця §12 `docs/architecture/test-contours.md`.
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
  // Порт сховища: `node:fs`, корінь із env і драйвер. Клієнт бере лише
  // `domain/media` (чистий резолв URL) — сюди йому не треба нічого.
  'storage',
  // Облік залишків (Е3-5): гвард stock_status пише в products /
  // product_modifications через ActorDb — сервер і тільки сервер.
  'inventory',
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

/**
 * Екранування рядка для вставки в regex-літерал.
 *
 * 🔴 Не декор: імена пакетів і підшляхів ідуть у патерн ПІДСТАНОВКОЮ, і в них
 * бувають метасимволи — `.` (`socket.io`), `+`, `-` у класі. Сьогодні таких у
 * `SERVER_ONLY_DEPS` немає — але додана колись залежність із крапкою мовчки
 * змінила б семантику межі: `.` збігся б із будь-яким символом, тобто патерн
 * став би ШИРШИМ за намір.
 *
 * Експортується, бо форму патерна задає ЧИТАЧ: Gate C матчить id модуля в
 * bundle-stats (сегмент шляху), а не bare-специфікатор, тож будує власний
 * вираз — але екранує тим самим хелпером, а не своєю копією.
 */
export const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Патерн специфікатора однієї серверної залежності (з урахуванням `clientSafe`). */
export const serverOnlyDepSpecifier = (dep: {
  readonly name: string;
  readonly clientSafe?: readonly string[];
}): RegExp => {
  const name = escapeRegExp(dep.name);
  return new RegExp(
    dep.clientSafe?.length
      ? `^${name}(/(?!(?:${dep.clientSafe.map(escapeRegExp).join('|')})(?:/|$))|$)`
      : `^${name}(/|$)`,
  );
};

/** Префікс декларації, під яким лежить субшлях (без `simplycms/`), або null. */
export const serverOnlyOwner = (subpath: string): string | null =>
  SERVER_ONLY.find((p) => subpath === p || subpath.startsWith(`${p}/`)) ?? null;

export const isServerOnlySubpath = (subpath: string): boolean =>
  serverOnlyOwner(subpath) !== null;

const alternation = SERVER_ONLY.join('|');

/** Форма опції `importProtection` плагіна Start — з його ж сигнатури. */
export type ImportProtectionOptions = NonNullable<
  NonNullable<Parameters<typeof tanstackStart>[0]>['importProtection']
>;

/**
 * Читач 6 — Import Protection (Vite-плагін Start), КЛІЄНТСЬКЕ середовище.
 * Повний обʼєкт опції, який три `vite.config.ts` (хост, шаблон магазину,
 * оверлей пілота) передають плагіну ОДНИМ рядком — складання на місці дало
 * б три копії, які розходяться (саме так гейт колись зеленів на
 * `enabled: false`).
 *
 * 🔴 Три пастки Start, усі виміряні (2026-09-02): (1) за замовчуванням
 * перевіряються лише імпортери в `src/` — тому `include: ['**']`, інакше
 * теми, плагіни й сам пакет ядра в node_modules лишились би поза перевіркою;
 * (2) у монорепо alias `simplycms/*` резолвить специфікатор РАНІШЕ за
 * перевірку — тому поруч зі `specifiers` є `files` по резолвленому шляху
 * (`simplycms/(src|dist)` покриває і `packages/simplycms/src/…`, і
 * `node_modules/simplycms/src/…`, не чіпаючи сторонні `simplycms-*`);
 * (3) `files`/`excludeFiles` дефолт Start ЗАМІЩУЮТЬ (`specifiers` —
 * зливаються), тому глоб `**` перед `/*.server.*` дописано вручну (інакше
 * конвенція Start зникла б), а дефолтний виняток
 * `node_modules` замінено лукахедом, що виключає все, КРІМ симлінка ядра
 * поруч із залежним пакетом
 * (`node_modules/.pnpm/simplycms@x/node_modules/simplycms/src/…`) — інакше
 * відносний шлях звідти обійшов би `specifiers`, а наш лінт чужого коду не
 * бачить.
 *
 * `behavior: 'error'` — рішення власника 2026-09-02; ключа `enabled` тут
 * немає навмисно — його наявність у будь-якому конфізі валить
 * `tests/import-protection-wiring.test.ts`.
 *
 * 🔴 `import type` з peer-пакета `@tanstack/react-start` — єдине зовнішнє
 * ребро T0 (лише типове, без рантайм-залежності); споживач `.d.ts` мусить
 * мати Start у дереві — магазин має його за побудовою.
 */
export const importProtection = (): ImportProtectionOptions => ({
  behavior: 'error',
  include: ['**'],
  client: {
    specifiers: [
      new RegExp(`^simplycms/(${alternation})(/|$)`),
      ...SERVER_ONLY_DEPS.map(serverOnlyDepSpecifier),
    ],
    files: [
      new RegExp(`simplycms/(src|dist)/(${alternation})(/|\\.[tj]sx?$)`),
      '**/*.server.*',
    ],
    excludeFiles: [/^(?!.*node_modules\/simplycms\/).*node_modules\//],
  },
});
