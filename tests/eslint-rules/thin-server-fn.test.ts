import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from '../../eslint-rules/thin-server-fn.mjs';

const linter = new Linter({ configType: 'flat' });
const config = (legacy: string[]): Linter.Config[] => [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    plugins: { o: { rules: { 'thin-server-fn': rule } } },
    rules: { 'o/thin-server-fn': ['error', { legacy }] },
  },
];
const lint = (code: string, legacy: string[] = []) =>
  linter.verify(code, config(legacy), { filename: 'f.ts' });

describe('simplycms-ops/thin-server-fn (І25)', () => {
  it.each<[string, string, string[]?]>([
    [
      'тонка обгортка',
      `export const a = createServerFn({ method: 'POST' }).validator(passThrough).handler(({ data }) => invokeFromServerFn(op, data));`,
    ],
    [
      'legacy-ім’я з тілом',
      `export const old = createServerFn({ method: 'GET' }).handler(async () => runAdmin(x));`,
      ['old'],
    ],
    [
      'legacy-ім’я з .handler(ідентифікатор)',
      `export const old = createServerFn({ method: 'GET' }).handler(oldOp);`,
      ['old'],
    ],
  ])('легально: %s', (_n, code, legacy) =>
    expect(lint(code, legacy)).toEqual([]),
  );

  it.each([
    [
      'тіло з await db',
      `export const a = createServerFn({ method: 'GET' }).handler(async () => { await db.select(); });`,
    ],
    [
      'handler(async () => runAdmin(...))',
      `export const a = createServerFn({ method: 'GET' }).handler(async () => runAdmin(x));`,
    ],
    [
      'трансформація даних',
      `export const a = createServerFn({ method: 'POST' }).handler(({ data }) => invokeFromServerFn(x, transform(data)));`,
    ],
    [
      'ім’я поза legacy-переліком з .handler(ідентифікатор)',
      `export const a = createServerFn({ method: 'GET' }).handler(op);`,
    ],
    [
      'async-стрілка навіть з invokeFromServerFn',
      `export const a = createServerFn({ method: 'POST' }).handler(async ({ data }) => invokeFromServerFn(x, data));`,
    ],
    [
      'ланцюжок без handler',
      `export const a = createServerFn({ method: 'GET' });`,
    ],
  ])('офендер: %s', (_n, code) => {
    const msgs = lint(code);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.message).toMatch(/не тонка/);
  });

  it('зникле ім’я в legacy-переліку — помилка', () => {
    const msgs = lint(
      `export const kept = createServerFn({ method: 'GET' }).handler(h);`,
      ['kept', 'gone'],
    );
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.message).toMatch(/«gone»/);
  });
});
