import { resolve } from 'node:path';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import rule from '../../eslint-rules/no-input-validator.mjs';

// Негативний контроль правила no-input-validator: `inputValidator` —
// @deprecated-аліас `validator` у TanStack Start, повернення старого імені
// знову дало б 285 попереджень компілятора на збірку.

const REPO = resolve(import.meta.dirname, '../..');
const linter = new Linter({ configType: 'flat' });
const config: Linter.Config[] = [
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { s: { rules: { 'no-input-validator': rule } } },
    rules: { 's/no-input-validator': 'error' },
  },
];
const lint = (code: string) =>
  linter.verify(code, config, { filename: resolve(REPO, 'probe.ts') });

describe('no-input-validator', () => {
  it.each([
    ['createServerFn', `createServerFn().inputValidator(x);`],
    ['createMiddleware', `createMiddleware().inputValidator(x);`],
    [
      'довгий ланцюжок',
      `export const f = createServerFn({ method: 'GET' }).inputValidator(s).handler(h);`,
    ],
    ['обчислений доступ', `createServerFn()['inputValidator'](x);`],
  ])('ловить: %s', (_label, code) => {
    expect(lint(code).map((m) => [m.ruleId, m.messageId])).toEqual([
      ['s/no-input-validator', 'deprecated'],
    ]);
  });

  it.each([
    ['createServerFn().validator', `createServerFn().validator(x);`],
    ['createMiddleware().validator', `createMiddleware().validator(x);`],
    [
      'довільний ідентифікатор',
      `const inputValidator = 1;\nexport { inputValidator };`,
    ],
  ])('пропускає: %s', (_label, code) => {
    expect(lint(code)).toEqual([]);
  });
});
