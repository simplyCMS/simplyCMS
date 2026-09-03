import { resolve } from 'node:path';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import rule from '../../eslint-rules/server-only-relative.mjs';

// Фікстури правила server-only-relative (трек T). Шлях файла — частина
// вхідних даних правила: воно резолвить специфікатор ВІДНОСНО імпортера і
// класифікує обидва кінці за деклараціями `contracts/server-only.ts`.

const REPO = resolve(import.meta.dirname, '../..');
const linter = new Linter({ configType: 'flat' });
const config: Linter.Config[] = [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { b: { rules: { 'server-only-relative': rule } } },
    rules: { 'b/server-only-relative': 'error' },
  },
];
const lint = (code: string, file: string) =>
  linter.verify(code, config, {
    filename: resolve(REPO, 'packages/simplycms/src', file),
  });

describe('server-only-relative (трек T)', () => {
  it.each([
    [
      'стаб → нутрощі',
      "import { ops } from './impl';",
      'admin-server/index.ts',
    ],
    [
      'стаб → нутрощі в теці',
      "export * from './impl/orders';",
      'admin-server/index.ts',
    ],
    [
      'динамічний import()',
      "const m = import('./impl');",
      'admin-server/index.ts',
    ],
    [
      'динамічний import() з template literal',
      'const m = import(`./impl`);',
      'admin-server/index.ts',
    ],
    [
      'між двома server-only деревами',
      "import { pool } from '../db/client';",
      'auth/index.ts',
    ],
    [
      // 🔴 Глибина `..` — частина кейсу: із `core/lib/` до `src/storefront`
      // два рівні вгору. Один рівень дав би неіснуючий `core/storefront/…`,
      // який межі не перетинає, — правило його й не мусить ловити.
      'клієнтський тір → лоадери',
      "import { x } from '../../storefront/loaders/db';",
      'core/lib/x.ts',
    ],
  ])('ловить: %s', (_label, code, file) => {
    expect(lint(code, file)).toHaveLength(1);
  });

  it.each([
    [
      'усередині server-only дерева',
      "import { withCustomerDb } from './db';",
      'storefront/loaders/session.ts',
    ],
    [
      'усередині impl/',
      "import { defineAdminResource } from './resource';",
      'admin-server/impl/orders.ts',
    ],
    [
      'bare-субшлях',
      "import { ops } from 'simplycms/admin-server/impl';",
      'admin-server/index.ts',
    ],
    [
      'відносний імпорт клієнтського модуля',
      "import { x } from './usePluginT';",
      'plugin-sdk/index.ts',
    ],
    [
      'файл поза src ядра',
      "import { x } from './impl';",
      '../../../src/routes/my/x.ts',
    ],
  ])('пропускає: %s', (_label, code, file) => {
    expect(lint(code, file)).toHaveLength(0);
  });
});
