import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

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
  // 🔴 `routes/storefront`, а не `routes/**`: межа зони — статус-кво до К0.
  // Тека `routes/admin` приїхала з пакета `@simplycms/admin-routes`, якого в
  // зоні не було ніколи, і в `routes/admin/admin.tsx` досі живе хардкоджений
  // рядок. Розширення зони — окреме рішення з міграцією рядка, не побічний
  // ефект переносу тек.
  'packages/simplycms/routes/storefront/**/*.tsx',
  'packages/simplycms/src/storefront-routes/**/*.tsx',
  'packages/simplycms/src/admin/**/*.tsx',
  'packages/simplycms/src/cart-ui/**/*.tsx',
  'packages/simplycms/src/catalog-ui/**/*.tsx',
  'packages/simplycms/src/checkout-ui/**/*.tsx',
  'packages/simplycms/src/profile-ui/**/*.tsx',
  'packages/simplycms/src/reviews-ui/**/*.tsx',
  'themes/*/components/**/*.tsx',
  // Референс-теми як пакети (Фаза 4): та сама зона, що й локальні `themes/*`,
  // — доставка кодом npm-пакета вимог i18n не послаблює.
  'packages/simplycms-theme-*/**/*.tsx',
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
// @simplycms/plugin-sdk — прямі імпорти Supabase-шару звідси заборонені.
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

const pluginTrustBoundaryImports = [
  {
    group: [
      'simplycms/supabase',
      'simplycms/supabase/*',
      'simplycms/data-supabase',
      'simplycms/data-supabase/*',
      '@supabase/*',
    ],
    message:
      'Плагін працює лише через порти @simplycms/plugin-sdk (межа довіри, спека §7).',
  },
];

// no-restricted-imports НЕ бачить динамічний import() — його ловить окремий
// селектор (знахідка рев'ю Фази 3). Регексп дзеркалить групи вище.
const pluginTrustBoundarySyntax = [
  {
    selector:
      'ImportExpression > Literal[value=/^(?:simplycms\\u002F(?:supabase|data-supabase)(?:\\u002F.*)?|@supabase\\u002F.*)$/]',
    message:
      'Плагін працює лише через порти @simplycms/plugin-sdk (межа довіри, спека §7) — динамічний import() теж.',
  },
];

const eslintConfig = [
  ...tseslint.configs.recommended,
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
    // Error-зона: обидва пакети ядра цілком. Warn-зони більше немає — міграцію
    // завершено, тож будь-який хардкод тут це помилка, а не борг.
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
