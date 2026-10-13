/**
 * Шум для `doc-symbols-exist.test.ts`: символи в доках, яких немає в коді
 * (сторонні API, приклади, заплановане). Запис — символ → причина; список лише
 * скорочується (мертвий запис червоніє в тесті).
 */
export const DOC_SYMBOL_ALLOWLIST: Readonly<Record<string, string>> = {
  // --- Next.js / Vendure / інші продукти, згадані як порівняння ---
  revalidatePath: 'Next.js API: дока пояснює, що ISR у нас немає',
  defineDashboardExtension: 'Vendure API у порівняльній таблиці платформ',
  AdminApp:
    'аналітичний документ напрямів: варіант з пакетом адмінки, якого немає',
  // --- TanStack / Vite / Playwright / Vitest ---
  routeFileIgnorePattern:
    'опція плагіна TanStack Router; в аналітичному документі напрямів',
  resolveAgainstImporter:
    'внутрішня функція import-protection плагіна Start (start-plugin-core), запис START-IP-1',
  resolveId: 'хук Vite/Rolldown-плагіна, запис START-IP-1',
  // --- Supabase (історичні розділи контурів) ---
  generateLink: 'Supabase Auth admin API у розділі про обхід листа',
  API_URL: 'ключ виводу `supabase status -o json` у історичному розділі',
  PUBLISHABLE_KEY:
    'ключ виводу `supabase status -o json` у історичному розділі',
  ERR_CONNECTION_REFUSED: 'код помилки браузера, цитата симптому',
  // --- npm / pnpm / CI ---
  NPM_TOKEN: 'secret GitHub Actions, не код репо',
  NODE_AUTH_TOKEN: 'змінна оточення npm/setup-node',
  ERR_PNPM_OUTDATED_LOCKFILE: 'код помилки pnpm, цитата',
  ERR_PNPM_NO_MATURE_MATCHING_VERSION: 'код помилки pnpm, цитата',
  onlyBuiltDependencies: 'ключ pnpm, згаданий як попередник `allowBuilds`',
  minimumReleaseAgeExclude: 'ключ pnpm, який дописує сама pnpm',
  maxRequestBodyBytes: 'опція Traefik (проксі перед магазином)',
  // --- Drizzle / drizzle-zod ---
  $inferInsert: 'властивість Drizzle-таблиці',
  entityKind: 'символ Drizzle, на якому ламаються подвійні копії',
  xIn: 'узагальнена позначка пари `insertIn`/`updateIn`/`removeIn` у поясненні',
  // --- @tanstack/db, query-db-collection (внутрішні імена бібліотеки в записах реєстру) ---
  removeQueries: 'метод TanStack Query, у записі TSDB-1',
  loadOrderedPrefixRepair: 'внутрішнє імʼя @tanstack/db, у записі TSDB-1',
  handleDeprecatedAutoRefetch:
    'внутрішнє імʼя query-db-collection, у записі TSDB-1',
  loadPage: 'внутрішнє імʼя @tanstack/db, у записі TSDB-2',
  startSyncIfIdle:
    'внутрішнє імʼя query-db-collection, у закритому записі TSDB-B1',
  withCollectionSyncConfigFactory:
    'внутрішнє імʼя query-db-collection, у закритому записі TSDB-B1',
  createWriteUtils:
    'внутрішнє імʼя query-db-collection, у закритому записі TSDB-B1',
  ensureContext:
    'внутрішнє імʼя query-db-collection, у закритому записі TSDB-B1',
  SyncContext: 'внутрішній тип query-db-collection, у закритому записі TSDB-B1',
  // --- TypeScript / typescript-eslint / tsdown ---
  ignoreDeprecations: 'опція tsconfig, у записі TSESL-1',
  TYPESCRIPT_ESLINT_NATIVE_BACKEND:
    'змінна оточення typescript-eslint, у записі TSESL-1',
  TypeChecker: 'тип TypeScript API, у записі TSESL-1',
  projectService: 'опція typescript-eslint, у записі TSESL-1',
  resolveDepSubpath: 'опція tsdown, у записі TSDOWN-1',
  // --- Claude Code ---
  PreToolUse: 'подія хука Claude Code',
  PostToolUse: 'подія хука Claude Code',
  SubagentStart: 'подія хука Claude Code',
  // --- API бібліотек і платформи, які код не імпортує поіменно ---
  allowBuilds: 'ключ pnpm-workspace, нова назва `onlyBuiltDependencies`',
  minimumReleaseAge: 'ключ pnpm-workspace',
  setQueryData: 'метод TanStack Query QueryClient',
  toISOString: 'метод Date (стандартна бібліотека)',
  multipleOf: 'ключ JSON Schema / Zod',
  NaN: 'глобал JavaScript',
  safeParse: 'метод схеми Zod',
  dangerouslySetInnerHTML: 'проп React',
  suppressHydrationWarning: 'проп React',
  transpileModule: 'метод TypeScript API',
  FormData: 'вебплатформний клас',
  formData: 'метод Request (вебплатформа)',
  localStorage: 'вебплатформний глобал',
  IntersectionObserver: 'вебплатформний глобал',
  scrollWidth: 'властивість DOM-елемента',
  innerText: 'властивість DOM-елемента / метод Playwright',
  isVisible: 'метод Playwright Locator (описано заборону миттєвих перевірок)',
  waitFor: 'утиліта Testing Library',
  expectTypeOf: 'утиліта Vitest',
  globalSetup: 'опція Playwright/Vitest',
  createPluginSetupTasks: 'внутрішнє імʼя Playwright',
  execValidator: 'внутрішнє імʼя Start (start-client-core)',
  extractSimpleComparisons: 'внутрішнє імʼя @tanstack/db',
  normalizeThrown: 'внутрішнє імʼя @tanstack/db (записи реєстру)',
  writeInsert: 'утиліта query-db-collection (записи реєстру)',
  writeUpsert: 'утиліта query-db-collection (записи реєстру)',
  writeDelete: 'утиліта query-db-collection (записи реєстру)',
  writeBatch: 'утиліта query-db-collection (записи реєстру)',
  updateCacheData: 'внутрішнє імʼя query-db-collection (записи реєстру)',
  gcTime: 'опція TanStack Query',
  SyncNotInitializedError: 'клас помилки @tanstack/db (записи реєстру)',
  getSerovalPlugins: 'внутрішнє імʼя Start (запис START-1)',
  getDefaultSerovalPlugins: 'внутрішнє імʼя Start (запис START-1)',
  defaultSerovalPlugins: 'внутрішнє імʼя Start (запис START-1)',
  makeSerovalPlugin: 'внутрішнє імʼя Start (запис START-1)',
  ShallowErrorPlugin: 'внутрішнє імʼя Start/seroval (запис START-1)',
  toCrossJSONAsync: 'API seroval (запис START-1)',
  fromCrossJSON: 'API seroval (запис START-1)',
  SelectedFields: 'тип Drizzle (запис DRZ-*)',
  $inferSelect: 'властивість Drizzle-таблиці',
  PgTableWithColumns: 'тип Drizzle (запис DRZ-*)',
  DrizzleQueryError: 'клас помилки Drizzle (запис реєстру)',
  isAlreadyPublished: 'внутрішня перевірка pnpm publish',
  inviteUserByEmail: 'Supabase Auth admin API в історичному розділі',
  FAILED_TO_CREATE_SESSION: 'код помилки Better Auth',
  INVALID_ORIGIN: 'код помилки Better Auth',
  TSR_ROUTES_BY_ID_MAP: 'змінна, яку генерує TanStack Router',
  srcDirectory: 'опція плагіна TanStack Start',
  ERR_PNPM_FETCH_404: 'код помилки pnpm, цитата',
  ERR_PNPM_IGNORED_BUILDS: 'код помилки pnpm, цитата',
  CollectionPage: 'тип schema.org у скілі редизайну',
  ItemList: 'тип schema.org у скілі редизайну',
  setDefault:
    'назва операції в прозі (сімейство `setDefault*` серверних функцій)',
  // --- інше ---
  __PLUGIN_NAME__: 'плейсхолдер шаблону скаффолдера (підставляється CLI)',
  __THEME_NAME__: 'плейсхолдер шаблону скаффолдера (підставляється CLI)',
  __THEME_DISPLAY_NAME__:
    'плейсхолдер шаблону скаффолдера (підставляється CLI)',
  __CORE_RANGE__: 'плейсхолдер шаблону скаффолдера (підставляється CLI)',
  simplyCMS: 'назва організації/бренду, не символ',
  ORIENT_DOC_VENV:
    'змінна скрипта orient (файл без розширення, не індексується)',
  // --- заплановане ---
  configSchema: 'заплановане в К5: форму налаштувань плагіна ядро ще не будує',
};
