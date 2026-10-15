import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from '../../eslint-rules/thin-server-fn.mjs';

const linter = new Linter({ configType: 'flat' });
const HEAD = `import { createServerFn } from '@tanstack/react-start';
import { invokeFromServerFn, passThrough } from 'simplycms/operations/server';
`;
const lint = (code: string, legacy: string[] = [], head = HEAD) =>
  linter.verify(
    head + code,
    [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tseslint.parser },
        plugins: { o: { rules: { 'thin-server-fn': rule } } },
        rules: { 'o/thin-server-fn': ['error', { legacy }] },
      },
    ],
    { filename: 'f.ts' },
  );
const THIN = `.validator(passThrough).handler(({ data }) => invokeFromServerFn(op, data))`;

describe('simplycms-ops/thin-server-fn (І25)', () => {
  it.each<[string, string, string[]?]>([
    [
      'тонка обгортка',
      `export const a = createServerFn({ method: 'POST' })${THIN};`,
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

  it.each<[string, string, string?]>([
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
      `export const a = createServerFn({ method: 'POST' }).validator(passThrough).handler(({ data }) => invokeFromServerFn(x, transform(data)));`,
    ],
    [
      'ім’я поза legacy-переліком з .handler(ідентифікатор)',
      `export const a = createServerFn({ method: 'GET' }).handler(op);`,
    ],
    [
      'async-стрілка навіть з invokeFromServerFn',
      `export const a = createServerFn({ method: 'POST' }).validator(passThrough).handler(async ({ data }) => invokeFromServerFn(x, data));`,
    ],
    [
      'ланцюжок без handler',
      `export const a = createServerFn({ method: 'GET' });`,
    ],
    [
      'логіка у валідаторі (обхід І25)',
      `export const a = createServerFn({ method: 'POST' }).validator(async (d) => { await getDb().delete(t); return d; }).handler(({ data }) => invokeFromServerFn(op, data));`,
    ],
    [
      'логіка у middleware (обхід І25)',
      `export const a = createServerFn({ method: 'POST' }).middleware([createMiddleware().server(async ({ next }) => { await withStorefrontDb((db) => db.delete(t)); return next(); })]).validator(passThrough).handler(({ data }) => invokeFromServerFn(op, data));`,
    ],
    [
      'без валідатора passThrough',
      `export const a = createServerFn({ method: 'POST' }).handler(({ data }) => invokeFromServerFn(op, data));`,
    ],
    [
      'зайвий ключ у createServerFn({...})',
      `export const a = createServerFn({ method: 'POST', extra: 1 })${THIN};`,
    ],
    [
      'аліас createServerFn',
      `export const a = mk({ method: 'GET' }).handler(async () => runAdmin(x));`,
      HEAD.replace('{ createServerFn }', '{ createServerFn as mk }'),
    ],
    [
      'namespace-імпорт',
      `export const a = rs.createServerFn({ method: 'GET' }).handler(async () => runAdmin(x));`,
      `import * as rs from '@tanstack/react-start';\n${HEAD}`,
    ],
    [
      'перепризначення const w = createServerFn',
      `const w = createServerFn; export const a = w({ method: 'GET' }).handler(async () => runAdmin(x));`,
    ],
    [
      'локальний invokeFromServerFn замість імпортованого',
      `const invokeFromServerFn = async (o, d) => { await db.x(); };
export const a = createServerFn({ method: 'POST' })${THIN};`,
      HEAD.replace(
        "import { invokeFromServerFn, passThrough } from 'simplycms/operations/server';",
        "import { passThrough } from 'simplycms/operations/server';",
      ),
    ],
    [
      'invokeFromServerFn з чужого модуля',
      `export const a = createServerFn({ method: 'POST' })${THIN};`,
      HEAD.replace('simplycms/operations/server', './local'),
    ],
  ])('офендер: %s', (_n, code, head) => {
    const msgs = lint(code, [], head as string | undefined);
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
