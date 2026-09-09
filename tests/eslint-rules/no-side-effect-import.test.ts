import { resolve } from 'node:path';
import { ESLint, Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import rule from '../../eslint-rules/no-side-effect-import.mjs';

// Фікстури правила no-side-effect-import (трек T).
//
// Правило тримає обіцянку `"sideEffects": false` трьох публікованих пакетів:
// без нього side-effect-імпорт, доданий колись усередині пакета, дозволив би
// бандлеру магазину викинути модуль — фіча зникла б у проді МОВЧКИ.
// Друга половина пари — асерт наявності самого поля в опублікованому
// tarball-і (`tests/published-exports-parity.test.ts`).

const REPO = resolve(import.meta.dirname, '../..');
const linter = new Linter({ configType: 'flat' });
const config: Linter.Config[] = [
  {
    // `.tsx` теж: інакше роут-файл ядра дав би ворнінг «File ignored», і кейс
    // зарахувався б за ним, а не за помилкою правила (урок сусіднього
    // server-only-relative).
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { s: { rules: { 'no-side-effect-import': rule } } },
    rules: { 's/no-side-effect-import': 'error' },
  },
];
const lint = (code: string) =>
  linter.verify(code, config, { filename: resolve(REPO, 'probe.ts') });

describe('no-side-effect-import (трек T)', () => {
  it.each([
    ['відносний модуль', "import './register-x';"],
    ['CSS-імпорт', "import './styles.css';"],
    ['bare-пакет', "import 'some-polyfill';"],
    // 🔴 Субшлях НЕ `simplycms/…`: `tests/audit-exports.test.ts` сканує репо
    // на bare-специфікатори ядра й зарахував би фікстуру за реальний імпорт
    // (спіймано прогоном — «simplycms/theme-registry — немає ключа в
    // exports»). Правило дивиться лише на кількість специфікаторів, тож імʼя
    // пакета в кейсі несуттєве.
    ['bare-субшлях', "import 'some-polyfill/register.js';"],
  ])('ловить: %s', (_label, code) => {
    expect(lint(code).map((m) => [m.ruleId, m.messageId])).toEqual([
      ['s/no-side-effect-import', 'sideEffectImport'],
    ]);
  });

  it.each([
    ['default-імпорт', "import x from './x';\nexport const a = x;"],
    ['іменований імпорт', "import { x } from './x';\nexport const a = x;"],
    ['namespace-імпорт', "import * as x from './x';\nexport const a = x;"],
    // `import type { X } from './x'` має специфікатор, тож у правило не
    // заходить; окремий кейс тримає це явним.
    ['type-імпорт', "import type { X } from './x';\nexport type Y = X;"],
    // Реекспорт — не side-effect-імпорт: він і є поіменним споживачем.
    ['реекспорт', "export { x } from './x';"],
    // Динамічний import() модуль у графі лишає завжди — tree-shaking його не
    // стосується, тож правилу тут нема чого ловити.
    ['динамічний import()', "const m = import('./x');\nexport default m;"],
  ])('пропускає: %s', (_label, code) => {
    expect(lint(code).map((m) => m.ruleId)).toEqual([]);
  });
});

/**
 * Контроль САМОЇ зони на РЕАЛЬНОМУ кореневому конфізі.
 *
 * 🔴 Фікстури вище ставлять правило власним інлайн-конфігом, тож звуження
 * зони до одного пакета, втрата роут-тек чи розростання на host `src/` були б
 * ТИХОЮ регресією — усі кейси лишились би зеленими. Тут ESLint читає
 * `eslint.config.mjs` репо (той самий прийом, що в
 * `tests/eslint-rules/server-only-relative.test.ts`).
 */
const RULE_ID = 'simplycms-sideeffects/no-side-effect-import';
const PROBE = "import './x';";

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
    // Рівно ті теки, що їдуть у tarball кожного з трьох пакетів (`files`
    // їхніх маніфестів).
    ['src ядра', 'packages/simplycms/src/core/probe.ts'],
    ['роут-тека ядра', 'packages/simplycms/routes/storefront/probe.tsx'],
    ['src теми', 'packages/simplycms-theme-solarstore/src/probe.ts'],
    ['src плагіна', 'packages/simplycms-plugin-faq/src/probe.ts'],
    ['роут-тека плагіна', 'packages/simplycms-plugin-faq/routes/probe.tsx'],
  ])('у зоні: %s', async (_label, filePath) => {
    expect(await ruleIds(PROBE, filePath)).toEqual([RULE_ID]);
  });

  it.each([
    // 🔴 Host — не бібліотека: його ніхто не бандлить із маніфестом, а
    // side-effect-імпорти там легальні за побудовою (`./theme-registry`,
    // `./styles/globals.css`). Розростання зони сюди зробило б гейт червоним
    // на правильному коді.
    ['host src/', 'src/routes/my/probe.ts'],
    // Тести в tarball не їдуть (`!src/**/__tests__/**` у `files`), тож
    // обіцянки маніфеста не стосуються.
    ['тести пакета', 'packages/simplycms/src/core/__tests__/probe.test.ts'],
    // Скаффолдер поля `sideEffects` не має — і не мусить.
    ['скаффолдер', 'packages/create-simplycms-store/src/probe.ts'],
  ])('поза зоною: %s', async (_label, filePath) => {
    expect(await ruleIds(PROBE, filePath)).toEqual([]);
  });
});
