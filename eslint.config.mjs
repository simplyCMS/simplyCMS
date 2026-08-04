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
      "Хардкоджений UI-рядок у JSX. Використай t('ключ') із @simplycms/i18n.",
  },
  {
    selector: CYRILLIC_JSX_ATTRIBUTE,
    message:
      "Хардкоджений UI-рядок у JSX-атрибуті (placeholder/title/aria-*). Використай t('ключ') із @simplycms/i18n.",
  },
];

// Файли, вже переведені на i18n: тут регрес до хардкоду — помилка.
// Розширювати список у міру міграції (див. platform-roadmap.md).
const I18N_MIGRATED_FILES = [
  'packages/simplycms/storefront-routes/src/shells/StorefrontShell.tsx',
  'packages/simplycms/storefront-routes/src/shells/ProtectedShell.tsx',
  'packages/simplycms/storefront-routes/src/pages/Cart.tsx',
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
      'packages/simplycms/schema/src/schema.ts',
      'packages/simplycms/schema/src/relations.ts',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    // Warn-зона: решта сторфронт-роутів і адмінка — міграція попереду.
    files: [
      'packages/simplycms/storefront-routes/**/*.tsx',
      'packages/simplycms/admin/**/*.tsx',
    ],
    rules: {
      'no-restricted-syntax': ['warn', ...i18nRestrictedSyntax],
    },
  },
  {
    // Error-зона: вже мігровані файли (блок ІДЕ ПІСЛЯ warn-зони — перекриває її).
    files: I18N_MIGRATED_FILES,
    rules: {
      'no-restricted-syntax': ['error', ...i18nRestrictedSyntax],
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
      // Fixture скретч-магазину (Task 3.1): це не код монорепо, а шаблон
      // ЧУЖОГО проєкту — його імпорти резолвляться лише після `npm install`
      // із tarball-ів у /tmp, а не workspace-аліасами.
      'tests/pilot/store-template/**',
      // Шаблон магазину в пакеті create-simplycms-store: це не код монорепо,
      // а файли ЧУЖОГО проєкту — його імпорти резолвляться лише після
      // `npm install` пакетів ядра в згенерованому магазині.
      //
      // 🔴 Виняток — `template/scripts/**`: це НЕ синкована копія host-каркаса,
      // а власний код шаблону (service_role-логіка owner:invite), двійника
      // якого в монорепо немає. Обґрунтування вище до нього не застосовне: він
      // імпортує лише node-builtin'и й `@supabase/supabase-js`, тож лінтується
      // як звичайний .mjs і не має ховатися від гейта.
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
    ],
  },
];

export default eslintConfig;
