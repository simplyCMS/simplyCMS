import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import {
  dbClientImportGroup,
  dbClientZoneConfig,
} from './eslint.db-client-zone.mjs';
import { tierZoneConfigs } from './eslint.tier-zones.mjs';
import queryKeyFromEntity from './eslint-rules/query-key-from-entity.mjs';
import serverFnTopLevel from './eslint-rules/server-fn-top-level.mjs';
import mutationCacheSync from './eslint-rules/mutation-cache-sync.mjs';
import serverOnlyRelative from './eslint-rules/server-only-relative.mjs';
import noSideEffectImport from './eslint-rules/no-side-effect-import.mjs';
import noDirectStorage from './eslint-rules/no-direct-storage.mjs';
import noServerOnlyInClient from './eslint-rules/no-server-only-in-client.mjs';
import noCollectionKeyOutsideAdminData from './eslint-rules/no-collection-key-outside-admin-data.mjs';
import jsxA11y from 'eslint-plugin-jsx-a11y';
// 🔴 Розширення `.ts` обовʼязкове: конфіг вантажить Node без транспіляції
// (type stripping), а він резолвить лише явні розширення.
import {
  SERVER_ONLY,
  SERVER_ONLY_DEPS,
  serverOnlyDepSpecifier,
} from './packages/simplycms/src/contracts/server-only.ts';

// Хардкоджені UI-рядки: кирилиця в JSX-тексті та в текстових JSX-атрибутах.
// Детектор саме на кирилицю — каталог uk-first, а `aria-hidden="true"` та інші
// технічні літерали не мають шуміти.
const CYRILLIC_JSX_TEXT = 'JSXText[value=/[\\u0400-\\u04FF]/]';
const CYRILLIC_JSX_ATTRIBUTE =
  'JSXAttribute[name.name=/^(placeholder|title|aria-)/] > Literal[value=/[\\u0400-\\u04FF]/]';

const i18nRestrictedSyntax = [
  {
    selector: CYRILLIC_JSX_TEXT,
    message:
      "Хардкоджений UI-рядок у JSX. Використай t('ключ') із simplycms/i18n.",
  },
  {
    selector: CYRILLIC_JSX_ATTRIBUTE,
    message:
      "Хардкоджений UI-рядок у JSX-атрибуті (placeholder/title/aria-*). Використай t('ключ') із simplycms/i18n.",
  },
];

// Зони, переведені на i18n: тут регрес до хардкоду — помилка.
//
// 🔴 Зелений лінт завершеності НЕ доводить: селектори бачать лише `JSXText` і
// три атрибути, тобто ~64 % роботи — toast, Zod, тернарники й мапи ярликів їм
// не видні. Повноту доводить `tests/i18n-coverage.test.ts` (AST-скан), і саме
// його `SCANNED_ROOTS` — ширший за цей список, бо бачить і `.ts`.
// Цей список — швидкий зворотний звʼязок в редакторі, не доказ.
//
// 🔴 Розширено 2026-08-09 з двох пакетів на всю воронку покупки, host і теми:
// доти `checkout-ui`/`profile-ui`/`catalog-ui`/`reviews-ui`/`cart-ui` не
// бачив ЖОДЕН гейт, і 293 хардкоджені рядки прожили там усю Фазу 1.
const I18N_MIGRATED_FILES = [
  'src/**/*.tsx',
  // К0: тіри вітрини й адмінки живуть теками флагмана. Зона перелічує саме
  // теки, а не `packages/simplycms/**`: каталоги `src/i18n/catalogs/uk` —
  // кирилиця за побудовою, і повний глоб зробив би error-зону самосуперечною.
  //
  // Обидві роут-теки ядра. `routes/admin` приїхала з пакета
  // `@simplycms/admin-routes`, якого в зоні не було ніколи, — борг закрито
  // 2026-08-21 разом із міграцією єдиного хардкоду (`AdminPending` →
  // `admin.common.loading`), тож зона більше не обривається на `storefront`.
  'packages/simplycms/routes/storefront/**/*.tsx',
  'packages/simplycms/routes/admin/**/*.tsx',
  'packages/simplycms/src/storefront-routes/**/*.tsx',
  'packages/simplycms/src/admin/**/*.tsx',
  'packages/simplycms/src/cart-ui/**/*.tsx',
  'packages/simplycms/src/catalog-ui/**/*.tsx',
  'packages/simplycms/src/checkout-ui/**/*.tsx',
  'packages/simplycms/src/profile-ui/**/*.tsx',
  'packages/simplycms/src/reviews-ui/**/*.tsx',
  // Реєстр колекцій адмінки (Task 9, Е1б): один .tsx у тесті (renderHook-
  // обгортка), тож зона розширена явно, а не покладена на успадкування.
  'packages/simplycms/src/admin-data/**/*.{ts,tsx}',
  'themes/*/components/**/*.tsx',
  // Референс-теми як пакети (Фаза 4): та сама зона, що й локальні `themes/*`,
  // — доставка кодом npm-пакета вимог i18n не послаблює.
  'packages/simplycms-theme-*/**/*.tsx',
];

// Доступні імена контролів воронки (К2-Е0, Е0-4, рішення Р5): у пʼяти теках
// воронки 41 `<label>` не звʼязаний ні з чим — скрінрідер і `getByLabelText`
// поля не знаходять. `cart-ui` у зоні наперед: форм там сьогодні нуль, і гейт
// має стояти ДО появи першої.
//
// 🔴 `src/admin/**` тут НЕМАЄ навмисно — з тієї ж причини, що й у зоні
// `query-key-from-entity` нижче: ~52 файли адмінки переписуються треком К3,
// правити їхні лейбли зараз означало б робити роботу двічі.
const A11Y_LABEL_ZONE = [
  'packages/simplycms/src/checkout-ui/**/*.tsx',
  'packages/simplycms/src/profile-ui/**/*.tsx',
  'packages/simplycms/src/catalog-ui/**/*.tsx',
  'packages/simplycms/src/reviews-ui/**/*.tsx',
  'packages/simplycms/src/cart-ui/**/*.tsx',
];

// Контракт серверного env (спека CLI v1 §7): серверний контур читає env ЛИШЕ
// з `process.env` і ЛИШЕ в рантаймі — `import.meta.env` там запікся б у білд.
// Стереже саме цей селектор, а не тест: у vitest `import.meta.env` — Proxy над
// `process.env` (один обʼєкт), тож рантайм-тест регрес джерела не побачить
// (див. packages/simplycms/src/supabase/__tests__/env-source.test.ts).
const IMPORT_META_ENV =
  'MemberExpression[object.type="MetaProperty"][property.name="env"]';

const serverEnvRestrictedSyntax = [
  {
    selector: IMPORT_META_ENV,
    message:
      'Серверний модуль читає env ЛИШЕ з process.env у рантаймі; import.meta.env запікається в білд. Контракт серверного env — спека CLI v1 §7 (docs/superpowers/specs/2026-08-13-cli-v1-design.md).',
  },
];

// ТОЧНО серверні модулі контракту §7. browser-client.ts та ізоморфний код
// (роут товару, simplycms.config.ts) — клієнтський контур: їм значення
// потрібне в бандлі, сюди їх НЕ додавати.
const SERVER_ENV_FILES = [
  'packages/simplycms/src/supabase/server-client.ts',
  'packages/simplycms/src/supabase/anon-client.ts',
  'packages/simplycms/src/storefront-routes/seo/robots.ts',
  'packages/simplycms/src/storefront-routes/seo/sitemap.ts',
  'packages/simplycms/routes/storefront/api/health.tsx',
  'src/start.ts',
];

// 🔴 Межа довіри плагінів (спека §7, Фаза 3): плагін працює ЛИШЕ через порти
// `simplycms/plugin-sdk` — прямі імпорти Supabase-шару звідси заборонені.
// Зона: локальні плагіни магазину (plugins/**) і публіковані референс-пакети
// (packages/simplycms-plugin-*/**). Глоб навмисно `simplycms-plugin-*`, а не
// `plugin-*`: plugin-system і plugin-sdk — ядро, їх зона не покриває.
// Селектори не послабляти; негативний контроль —
// tests/plugin-trust-boundary.test.ts (зелений лінт сам по собі скоупінг
// зони не доводить — урок env-контракту).
const PLUGIN_TRUST_BOUNDARY_FILES = [
  'plugins/**/*.{ts,tsx}',
  'packages/simplycms-plugin-*/**/*.{ts,tsx}',
];

// Точковий ратчет `mutation-cache-sync` (Task 11, Е1б): сторінки
// `src/admin/pages/*`, вже переписані на TanStack DB-колекції й тому
// зобовʼязані тримати гейт. Список РОСТЕ з хвилями Е3–Е6 (обернений
// PENDING_FILES) — стартово одна сторінка з Task 10.
const MUTATION_CACHE_SYNC_RATCHET = [
  'packages/simplycms/src/admin/pages/OrderStatuses.tsx',
];

// 🔴 Похідне від ЄДИНОЇ декларації межі (`contracts/server-only.ts`): усі
// server-only субшляхи ядра й серверні залежності — bare і з підшляхами.
// Літерали нижче — те, що плагіну заборонено ПОНАД server-only: Supabase-шар
// адмінки (до К3) і serverFn-модулі ядра (`admin-server`, `plugin-sdk/server`):
// плагін кличе хуки SDK, а не хендлери під ними.
const PLUGIN_BOUNDARY_MESSAGE =
  'Плагін працює лише через порти simplycms/plugin-sdk (межа довіри, спека §7).';
// Залежності без винятків ідуть глобами; ті, що мають `clientSafe`, — ні:
// gitignore-заперечення в `group` підшлях НЕ звільняє (перевірено на
// ESLint 10.8 — усі три форми `better-auth` червоніли), тож для них
// окремий патерн `regex` із лукахедом із самої декларації.
const serverOnlyImportGroup = [
  ...SERVER_ONLY.flatMap((sub) => [`simplycms/${sub}`, `simplycms/${sub}/*`]),
  ...SERVER_ONLY_DEPS.filter((dep) => !dep.clientSafe?.length).flatMap(
    (dep) => [dep.name, `${dep.name}/*`],
  ),
];
const clientSafeDepPatterns = SERVER_ONLY_DEPS.filter(
  (dep) => dep.clientSafe?.length,
).map((dep) => ({
  regex: serverOnlyDepSpecifier(dep).source,
  message: PLUGIN_BOUNDARY_MESSAGE,
}));
const pluginOnlySurfaceGroup = [
  'simplycms/supabase',
  'simplycms/supabase/*',
  '@supabase/*',
  'simplycms/plugin-sdk/server',
  'simplycms/plugin-sdk/server/*',
  'simplycms/admin-server',
  'simplycms/admin-server/*',
];
const pluginTrustBoundaryImports = [
  {
    group: [...pluginOnlySurfaceGroup, ...serverOnlyImportGroup],
    message: PLUGIN_BOUNDARY_MESSAGE,
  },
  ...clientSafeDepPatterns,
  // Flat config замінює опції правила цілком, тож глобальну зону
  // `simplycms/db/client` доливаємо сюди явно — інакше блок мовчки зняв би її
  // з `plugins/**` (той самий прийом, що з i18n-селекторами в env-зоні).
  dbClientImportGroup,
];

// no-restricted-imports НЕ бачить динамічний import() — його ловить окремий
// селектор (знахідка рев'ю Фази 3). Regex будується з тих самих списків, що
// й групи вище; `/` у селекторі ESLint пишеться як \u002F.
const esq = (items) => items.map((s) => s.replace(/\//g, '\\u002F')).join('|');
// 🔴 Альтернатива кожної залежності ДЕРИВУЄТЬСЯ з `serverOnlyDepSpecifier`, а
// не пишеться тут удруге: копія логіки `clientSafe` вже одного разу розійшлася
// з декларацією (`better-auth/reactor` був заборонений статичним імпортом і
// дозволений динамічним). Дві відмінності форми — вимушені:
//   • `^` знімаємо: селектор має власний якір навколо всієї альтернації;
//   • `.*` дописуємо: патерн декларації — ПРЕФІКСНИЙ тест (`^name(/|$)`), а тут
//     альтернатива мусить покрити ЦІЛИЙ специфікатор до `$`.
// `/` у селекторі ESLint пишеться як \u002F, причому в `source` слеш уже
// екранований (`\/`) — звідси `\\?\/` у регексі заміни.
const esqDeps = () =>
  SERVER_ONLY_DEPS.map((dep) =>
    `${serverOnlyDepSpecifier(dep).source.replace(/^\^/, '')}.*`.replace(
      /\\?\//g,
      '\\u002F',
    ),
  ).join('|');
const pluginTrustBoundarySyntax = [
  {
    selector: `ImportExpression > Literal[value=/^(?:simplycms\\u002F(?:supabase|plugin-sdk\\u002Fserver|admin-server|${esq(SERVER_ONLY)})(?:\\u002F.*)?|@supabase\\u002F.*|(?:${esqDeps()}))$/]`,
    message:
      'Плагін працює лише через порти simplycms/plugin-sdk (межа довіри, спека §7) — динамічний import() теж.',
  },
];

const eslintConfig = [
  ...tseslint.configs.recommended,
  // Зона «зʼєднання лише через withActor» (Task 6, В2-К1а) — глобальна, тому
  // стоїть тут, ДО зон, що теж ставлять `no-restricted-imports`: ті доливають
  // її групу до своїх патернів (див. `eslint.db-client-zone.mjs`).
  // Негативний контроль — `tests/db-client-boundary.test.ts`.
  dbClientZoneConfig,
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Машинно згенеровані drizzle-kit'ом файли: `(table) => [...]` подекуди не
    // використовує аргумент, а перейменувати його не можна — наступний `pull`
    // все одно перезапише. Решту правил лишаємо ввімкненими.
    files: [
      'packages/simplycms/src/schema/schema.ts',
      'packages/simplycms/src/schema/relations.ts',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    // Error-зона: host `src/`, перелічені теки флагмана, теми й референс-теми
    // — точний склад див. у `I18N_MIGRATED_FILES` вище (це список ТЕК, а не
    // пакет цілком). Warn-зони більше немає — міграцію завершено, тож
    // будь-який хардкод тут це помилка, а не борг.
    files: I18N_MIGRATED_FILES,
    rules: {
      'no-restricted-syntax': ['error', ...i18nRestrictedSyntax],
    },
  },
  {
    // Серверні модулі контракту env (§7). `health.tsx` входить і в
    // I18N_MIGRATED_FILES, а flat config ЗАМІНЮЄ опції правила цілком, не
    // доливає — тому i18n-селектори повторено тут явно, інакше цей блок
    // мовчки вимкнув би їх на перетині (у `.ts`-файлах JSX-селектори інертні).
    files: SERVER_ENV_FILES,
    rules: {
      'no-restricted-syntax': [
        'error',
        ...i18nRestrictedSyntax,
        ...serverEnvRestrictedSyntax,
      ],
    },
  },
  {
    // Межа довіри плагінів. Статичні імпорти/export-from — no-restricted-
    // imports (окреме правило, перетин з i18n безпечний); динамічний
    // import() — селектор no-restricted-syntax, і оскільки flat config
    // ЗАМІНЮЄ опції правила цілком, i18n-селектори повторено тут явно
    // (той самий прийом, що в env-зоні вище).
    files: PLUGIN_TRUST_BOUNDARY_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: pluginTrustBoundaryImports },
      ],
      'no-restricted-syntax': [
        'error',
        ...i18nRestrictedSyntax,
        ...pluginTrustBoundarySyntax,
      ],
    },
  },
  // Тір-зони напрямку шарів (ПК3, К0): по блоку на теку флагмана. Таблиця й
  // обґрунтування — `eslint.tier-zones.mjs` (винесено окремим модулем, щоб
  // конфіг лишався читним). Правило тут `no-restricted-imports`, тож перетину
  // опцій з i18n/env-зонами `no-restricted-syntax` немає; зона межі довіри
  // плагінів теж не перетинається — її глоби (`plugins/**`,
  // `packages/simplycms-plugin-*/**`) поза `packages/simplycms/`.
  // Негативний контроль кожної зони — `tests/tier-boundary.test.ts`.
  ...tierZoneConfigs,
  // Ключі кешу вітрини — з реєстру ENTITY/AGGREGATE/SESSION_KEY (V2-К3,
  // рішення К3-3), не літералом. Кастомне AST-правило, а не селектор у
  // `no-restricted-syntax`: ця зона накриває `storefront-routes/**` і
  // `*-ui/**`, які вже під i18n-зоною (`I18N_MIGRATED_FILES` вище), а flat
  // config ЗАМІНЮЄ опції правила цілком — спільний `no-restricted-syntax`
  // тут мовчки вимкнув би один із двох детекторів залежно від порядку
  // конфігів. Окреме імʼя правила прибирає перетин повністю.
  //
  // 🔴 `src/admin/**` тут НЕМАЄ навмисно: її ~170 літеральних ключів
  // зникнуть разом зі сторінками адмінки в Е1б–Е6, правити їх зараз
  // означало б робити роботу двічі. Додати теку — крок завершення
  // переписування адмінки (DoD К3-3).
  //
  // 🔴 Референс-тема й референс-плагін — теж у зоні (борг Е1а №8, Е3-12):
  // `simplycms/contracts/entities` — публічний T0-субшлях, межа довіри тем
  // (`docs/architecture/themes.md`) її не забороняє; рішення архітектора
  // зняло точку зупинки плану. Плагін лишається в зоні на випадок власних
  // ключів по `ENTITY` — таблиці плагіна (`plg_*`) там немає, тож зона
  // сьогодні лише фіксує стан.
  {
    files: [
      'packages/simplycms/src/core/**/*.{ts,tsx}',
      'packages/simplycms/src/*-ui/**/*.{ts,tsx}',
      'packages/simplycms/src/react-query/**/*.{ts,tsx}',
      'packages/simplycms/src/storefront-routes/**/*.{ts,tsx}',
      'packages/simplycms/src/admin-data/**/*.{ts,tsx}',
      'packages/simplycms-theme-solarstore/src/**/*.{ts,tsx}',
      'packages/simplycms-plugin-faq/src/**/*.{ts,tsx}',
    ],
    ignores: ['**/__tests__/**'],
    plugins: {
      simplycms: { rules: { 'query-key-from-entity': queryKeyFromEntity } },
    },
    rules: { 'simplycms/query-key-from-entity': 'error' },
  },
  // Мутація без сліду в кеші (Task 11, Е1б) — клієнтська половина інваріанту
  // «мутація ⇒ кеш бачить наслідок»; серверну половину (persistence-хендлери
  // onInsert/onUpdate/onDelete) стереже окремий AST-гейт tests/handler-canon.test.ts.
  // Зона — фабрики колекцій (`admin-data`) + точковий ратчет переписаних
  // сторінок адмінки (`MUTATION_CACHE_SYNC_RATCHET`): список РОСТЕ з хвилями
  // Е3–Е6 у міру того, як `src/admin/pages/*` переходять на TanStack DB —
  // патерн, обернений до `PENDING_FILES` i18n-гейта (там список звужується
  // до порожнього, тут — росте від порожнього). Окреме імʼя плагіна
  // (`simplycms-cache-sync`, не `simplycms`) — з тієї самої причини, що в
  // зоні `server-fn-top-level`: flat config замінює опції правила цілком,
  // а не доливає, і обидві зони перетинаються на `admin-data/**`.
  {
    files: [
      'packages/simplycms/src/admin-data/**/*.{ts,tsx}',
      ...MUTATION_CACHE_SYNC_RATCHET,
    ],
    ignores: ['**/__tests__/**'],
    plugins: {
      'simplycms-cache-sync': {
        rules: { 'mutation-cache-sync': mutationCacheSync },
      },
    },
    rules: { 'simplycms-cache-sync/mutation-cache-sync': 'error' },
  },
  // К3-4′: createServerFn лише топ-рівневим `const` — компілятор Start
  // на повільному шляху падає, а на fast-path (файли, де детектовано лише
  // serverFn) МОВЧКИ пропускає нетоплевел-виклик, і серверний граф їде в
  // клієнтський бандл (див. eslint-rules/server-fn-top-level.mjs). Окреме
  // імʼя плагіна (`simplycms-serverfn`, не `simplycms`) — щоб опції не
  // зливались із `query-key-from-entity` (flat config замінює опції
  // правила цілком, а не доливає).
  {
    files: [
      'packages/simplycms/src/**/*.{ts,tsx}',
      'packages/simplycms/routes/**/*.tsx',
      'src/**/*.{ts,tsx}',
    ],
    plugins: {
      'simplycms-serverfn': {
        rules: { 'server-fn-top-level': serverFnTopLevel },
      },
    },
    rules: { 'simplycms-serverfn/server-fn-top-level': 'error' },
  },
  // Файли — лише через порт (рішення Е2-9). Окреме імʼя плагіна
  // (`simplycms-storage`) — щоб опції не зливались із сусідніми правилами.
  // 🔴 `ignores` — ратчет: `ReviewDetail.tsx` мертвий і переписується
  // хвилею відгуків разом із цим викликом. Список дзеркалиться в
  // `tests/storage-direct-calls.test.ts` і може тільки скорочуватись.
  {
    files: ['packages/simplycms/src/**/*.{ts,tsx}'],
    ignores: ['packages/simplycms/src/admin/pages/ReviewDetail.tsx'],
    plugins: {
      'simplycms-storage': { rules: { 'no-direct-storage': noDirectStorage } },
    },
    rules: { 'simplycms-storage/no-direct-storage': 'error' },
  },
  // Ключ колекції admin-data — лише для колекцій admin-data (Е3-15′,
  // рішення архітектора). Власне правило (не тір-зона, не
  // query-key-from-entity — та ловить літерали в queryKey, а не сам факт
  // імпорту функції); власне імʼя плагіна — з тієї ж причини, що в сусідніх
  // `simplycms-storage`/`simplycms-client-boundary`: flat config замінює
  // опції правила цілком, а ESLint 10 падає на редефініції плагіна з іншим
  // rules-обʼєктом на тих самих файлах.
  // 🔴 `admin-data/**` і `__tests__/**` — НЕ виїмка-послаблення, а межа зони:
  // усередині admin-data collectionKey — канон, а __tests__ (зокрема
  // `contracts/__tests__/entity-key.test.ts`) юніт-тестує саму функцію
  // напряму відносним імпортом — без ignores це хибне спрацювання.
  {
    files: [
      'packages/simplycms/src/**/*.{ts,tsx}',
      'packages/simplycms-theme-solarstore/**/*.{ts,tsx}',
      'packages/simplycms-plugin-faq/**/*.{ts,tsx}',
    ],
    ignores: ['packages/simplycms/src/admin-data/**', '**/__tests__/**'],
    plugins: {
      'simplycms-collection-key': {
        rules: {
          'no-collection-key-outside-admin-data':
            noCollectionKeyOutsideAdminData,
        },
      },
    },
    rules: {
      'simplycms-collection-key/no-collection-key-outside-admin-data': 'error',
    },
  },
  // Сьомий читач межі довіри клієнт/сервер (contracts/server-only): клієнтська
  // тека не імпортує server-only субшлях чи серверну залежність. Власне
  // правило, бо базовий `no-restricted-imports` не розрізняє `import` і
  // `import type` — `import type` стирається компілятором і в бандл не
  // потрапляє, тож заборона на нього зламала б канон `OrderStatuses.tsx`
  // (Е1а). `core` тут навмисно немає: `core/lib/**` — serverFn-модулі, які
  // легально імпортують `simplycms/storefront/loaders`.
  // 🔴 `admin-data` — у зоні поруч з `admin`: колекції TanStack DB
  // виконуються в браузері за побудовою (К3-9′ п.3), тож типи рядків беруть
  // лише `import type` з `simplycms/schema/types`/`simplycms/admin-server/impl`
  // — саме це стереже `tests/tier-boundary-client-boundary.test.ts`.
  // 🔴 Плагін НЕ `simplycms-boundary` (як у сусіднього `server-only-relative`,
  // хоч план це й пропонував): flat config забороняє редефініцію плагіна під
  // тим самим імʼям, якщо два конфіги з різними rules-обʼєктами покривають
  // ті самі файли (`admin/**` і `*-ui/**` — підмножина зони server-only-relative)
  // — перевірено `pnpm lint`: `ConfigError: Cannot redefine plugin
  // "simplycms-boundary"`. Тому окреме імʼя.
  {
    files: [
      'packages/simplycms/src/admin/**/*.{ts,tsx}',
      'packages/simplycms/src/{cart,catalog,checkout,profile,reviews}-ui/**/*.{ts,tsx}',
      'packages/simplycms/src/admin-data/**/*.{ts,tsx}',
    ],
    plugins: {
      'simplycms-client-boundary': {
        rules: { 'no-server-only-in-client': noServerOnlyInClient },
      },
    },
    rules: { 'simplycms-client-boundary/no-server-only-in-client': 'error' },
  },
  // Трек T: межа довіри всередині шару — відносний імпорт у server-only
  // дерево ззовні нього (стаб `admin-server/index` → `./impl`) заінлайнив би
  // серверні нутрощі в клієнтський модуль без сліду в `dist`.
  // 🔴 Тести виведені з зони: правило стереже граф, який ЇДЕ в `dist`, а
  // `__tests__` туди не потрапляють — відносний імпорт server-only дерева з
  // тесту межу не пробиває.
  {
    files: ['packages/simplycms/{src,routes}/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    plugins: {
      'simplycms-boundary': {
        rules: { 'server-only-relative': serverOnlyRelative },
      },
    },
    rules: { 'simplycms-boundary/server-only-relative': 'error' },
  },
  // Трек T увімкнув `"sideEffects": false` у трьох публікованих пакетах —
  // отже, зобовʼязався тримати обіцянку правдивою. Причина, чому це окреме
  // правило, а не селектор у спільному `no-restricted-syntax` (перетин із
  // трьома чинними зонами того ж правила + заміщення опцій flat config-ом),
  // і вимір, що це доводить, — у `eslint-rules/no-side-effect-import.mjs`.
  //
  // Зона — рівно ті теки, що їдуть у tarball кожного з трьох пакетів
  // (`files` їхніх маніфестів): у ядрі й у плагіні це `src` + `routes`, у
  // темі — `src`. Список пакетів із полем стереже
  // `tests/published-exports-parity.test.ts`; `src/` host-а сюди НЕ входить
  // — магазин ніхто не бандлить як бібліотеку, і side-effect-імпорти там
  // (`./theme-registry`, `./styles/globals.css`) легальні за побудовою.
  //
  // 🔴 `__tests__` виведені: у tarball вони не їдуть (`!src/**/__tests__/**`
  // у `files`), тож обіцянки маніфеста не стосуються.
  {
    files: [
      'packages/simplycms/{src,routes}/**/*.{ts,tsx}',
      'packages/simplycms-theme-solarstore/src/**/*.{ts,tsx}',
      'packages/simplycms-plugin-faq/{src,routes}/**/*.{ts,tsx}',
    ],
    ignores: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    plugins: {
      'simplycms-sideeffects': {
        rules: { 'no-side-effect-import': noSideEffectImport },
      },
    },
    rules: { 'simplycms-sideeffects/no-side-effect-import': 'error' },
  },
  // Зона доступних імен. Імʼя правила (`jsx-a11y/label-has-associated-control`)
  // унікальне, тож пастки flat config-у «опції правила ЗАМІЩУЮТЬСЯ, а не
  // доливаються» тут немає: зона перетинається з i18n-зоною й із
  // `query-key-from-entity`, але жодна з них цього правила не ставить.
  //
  // 🔴 `assert: 'htmlFor'`, а не дефолт: з дефолтним `'either'` правило на
  // цьому коді дає 5 помилок замість 41 — будь-який `{t('…')}` усередині
  // лейбла воно вважає «можливо, контрол вкладений» і мовчить (виміряно
  // прогоном 6.10.2 під ESLint 10.8.0). `depth: 3` — щоб лейбли-обгортки
  // radio/checkbox, де підпис лежить у `label > div > span`, не червоніли
  // окремим повідомленням «must have accessible text».
  //
  // 🔴 Правило бачить лише `<label>`: контрол БЕЗ лейбла для нього невидимий
  // (у зоні таких 9 — попапи чекауту, числові діапазони фільтра, прихований
  // avatar-input). Зелений лінт доступності воронки не доводить.
  {
    files: A11Y_LABEL_ZONE,
    ignores: ['**/__tests__/**'],
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      'jsx-a11y/label-has-associated-control': [
        'error',
        { assert: 'htmlFor', depth: 3 },
      ],
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '**/dist/**',
      'dist-ssr/**',
      '.output/**',
      '.nitro/**',
      '.tanstack/**',
      'src/routeTree.gen.ts',
      // Лендінг apps/www: власний згенерований роут-трі (той самий автор —
      // генератор TanStack Router, що й у host)
      'apps/www/src/routeTree.gen.ts',
      // Fixture скретч-магазину (Task 3.1): це не код монорепо, а шаблон
      // ЧУЖОГО проєкту — його імпорти резолвляться лише після `npm install`
      // із tarball-ів у /tmp, а не workspace-аліасами.
      'tests/pilot/store-template/**',
      // Шаблон магазину в пакеті create-simplycms-store: це не код монорепо,
      // а файли ЧУЖОГО проєкту — його імпорти резолвляться лише після
      // `npm install` пакетів ядра в згенерованому магазині.
      //
      // 🔴 Виняток — `template/scripts/**`. Спочатку там жив лише власний код
      // шаблону (service_role-логіка owner:invite), двійника якого в монорепо
      // немає; обґрунтування вище до нього не застосовне — він імпортує лише
      // node-builtin'и й `@supabase/supabase-js`, тож лінтується як звичайний
      // .mjs і не має ховатися від гейта.
      //
      // (Скрипти design-import жили тут синкованою копією до переїзду в
      // `.claude/skills/redesign-from-reference/scripts/` — тепер та копія
      // під загальним template-ігнором, а джерело лінтується в `.agents/`.)
      //
      // 🔴 Чому не одне `template/**` + `!template/scripts/**`: патерн, що
      // закінчується на `/**`, ESLint трактує як ігнор ЦІЛОЇ гілки дерева і
      // жодна наступна негація його вже не скасовує (перевірено
      // `ESLint#isPathIgnored`). Тому ігнор розкладено на рівень-1 (`/*`) плюс
      // вкладене (`/*/**`), і кожен знято окремою негацією.
      'packages/create-simplycms-store/template/*',
      'packages/create-simplycms-store/template/*/**',
      '!packages/create-simplycms-store/template/scripts',
      '!packages/create-simplycms-store/template/scripts/**',
      // Канон host-файлів пакета CLI (спека CLI v1 §5): та сама байт-копія
      // host-каркаса, що й у шаблоні вище, — знімок для `simplycms update`,
      // чиї імпорти резолвляться лише всередині згенерованого магазину.
      'packages/cli/host/**',
    ],
  },
];

export default eslintConfig;
