import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

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
