import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Хардкоджені UI-рядки: кирилиця в JSX-тексті та в текстових JSX-атрибутах.
// Детектор саме на кирилицю — каталог uk-first, а `aria-hidden="true"` та інші
// технічні літерали не мають шуміти.
const CYRILLIC_JSX_TEXT = "JSXText[value=/[\\u0400-\\u04FF]/]";
const CYRILLIC_JSX_ATTRIBUTE =
  "JSXAttribute[name.name=/^(placeholder|title|aria-)/] > Literal[value=/[\\u0400-\\u04FF]/]";

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
  "packages/simplycms/storefront-routes/src/shells/StorefrontShell.tsx",
  "packages/simplycms/storefront-routes/src/shells/ProtectedShell.tsx",
  "packages/simplycms/storefront-routes/src/pages/Cart.tsx",
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
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // Машинно згенеровані drizzle-kit'ом файли: `(table) => [...]` подекуди не
    // використовує аргумент, а перейменувати його не можна — наступний `pull`
    // все одно перезапише. Решту правил лишаємо ввімкненими.
    files: [
      "packages/simplycms/schema/src/schema.ts",
      "packages/simplycms/schema/src/relations.ts",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Warn-зона: решта сторфронт-роутів і адмінка — міграція попереду.
    files: [
      "packages/simplycms/storefront-routes/**/*.tsx",
      "packages/simplycms/admin/**/*.tsx",
    ],
    rules: {
      "no-restricted-syntax": ["warn", ...i18nRestrictedSyntax],
    },
  },
  {
    // Error-зона: вже мігровані файли (блок ІДЕ ПІСЛЯ warn-зони — перекриває її).
    files: I18N_MIGRATED_FILES,
    rules: {
      "no-restricted-syntax": ["error", ...i18nRestrictedSyntax],
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "**/dist/**",
      "dist-ssr/**",
      ".output/**",
      ".nitro/**",
      ".tanstack/**",
      "src/routeTree.gen.ts",
    ],
  },
];

export default eslintConfig;
