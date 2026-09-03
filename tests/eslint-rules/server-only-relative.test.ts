import { resolve } from 'node:path';
import { ESLint, Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import rule from '../../eslint-rules/server-only-relative.mjs';

// Фікстури правила server-only-relative (трек T). Шлях файла — частина
// вхідних даних правила: воно резолвить специфікатор ВІДНОСНО імпортера і
// класифікує обидва кінці за деклараціями `contracts/server-only.ts`.

const REPO = resolve(import.meta.dirname, '../..');
const linter = new Linter({ configType: 'flat' });
const config: Linter.Config[] = [
  {
    // 🔴 І `.tsx` теж: роут-файли ядра мають саме це розширення, а файл, до
    // якого не підійшов жоден блок конфігу, дав би ворнінг «File ignored» —
    // і кейс «ловить» зарахувався б за цим ворнінгом, а не за помилкою правила.
    files: ['**/*.{ts,tsx}'],
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
    [
      // Роут-теки ядра теж їдуть у tarball (`files` маніфеста), тож відносна
      // втеча звідти резолвиться в магазині в TS-джерело з node_modules —
      // повз `dist` і повз Import Protection.
      'роут-файл ядра → src/db',
      "import { x } from '../../src/db/client';",
      '../routes/storefront/x.tsx',
    ],
  ])('ловить: %s', (_label, code, file) => {
    // 🔴 Асерт саме на пару rule/message, а не на довжину: фатальна помилка
    // парсингу і ворнінг «File ignored» з `ruleId: null` дають довжину 1 так
    // само — і кейс зеленів би, доки правило мовчить (спіймано на `.tsx`).
    expect(lint(code, file).map((m) => [m.ruleId, m.messageId])).toEqual([
      ['b/server-only-relative', 'crossesBoundary'],
    ]);
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
      'bare-субшлях із роут-файлу ядра',
      "import { withActor } from 'simplycms/db';",
      '../routes/storefront/x.tsx',
    ],
    [
      // Файл ХОСТА — поза пакетом ядра, тож правило до нього не застосовується
      // (bare-межу там тримають тір-зони й Import Protection).
      'файл поза пакетом ядра',
      "import { x } from './impl';",
      '../../../src/routes/my/x.ts',
    ],
  ])('пропускає: %s', (_label, code, file) => {
    // Порожнім має бути ВЕСЬ вивід: ворнінг парсера тут теж означав би, що
    // кейс перевіряє не те, що заявляє.
    expect(lint(code, file).map((m) => m.ruleId)).toEqual([]);
  });
});

/**
 * Контроль САМОЇ зони на РЕАЛЬНОМУ кореневому конфізі.
 *
 * 🔴 Фікстури вище ставлять правило власним інлайн-конфігом, тож звуження
 * зони назад до `src/**` або втрата/розростання `ignores` були б ТИХОЮ
 * регресією: усі 13 кейсів лишились би зеленими. Тут ESLint читає
 * `eslint.config.mjs` репо — той самий прийом, що в
 * `tests/plugin-trust-boundary.test.ts`.
 */
const RULE_ID = 'simplycms-boundary/server-only-relative';

describe('зона правила в кореневому конфізі', () => {
  let eslint: ESLint;

  beforeAll(() => {
    eslint = new ESLint({ cwd: REPO });
  });

  const ruleIds = async (code: string, filePath: string) => {
    const [result] = await eslint.lintText(code, {
      filePath: resolve(REPO, filePath),
      warnIgnored: true,
    });
    return (result?.messages ?? [])
      .filter((m) => m.ruleId === RULE_ID)
      .map((m) => m.ruleId);
  };

  it.each([
    [
      'роут-тека ядра в зоні',
      "import { x } from '../../src/db/client';",
      'packages/simplycms/routes/storefront/x.tsx',
    ],
    [
      'src ядра в зоні',
      "import { ops } from './impl';",
      'packages/simplycms/src/admin-server/index.ts',
    ],
  ])('%s', async (_label, code, filePath) => {
    expect(await ruleIds(code, filePath)).toEqual([RULE_ID]);
  });

  it('тести виведені з зони (ignores не зʼїдений і не розширений)', async () => {
    expect(
      await ruleIds(
        "import { db } from '../../storefront/loaders/db';",
        'packages/simplycms/src/storefront-routes/__tests__/x.test.ts',
      ),
    ).toEqual([]);
  });
});
