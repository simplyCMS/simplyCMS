import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from '../../eslint-rules/no-core-outside-operation.mjs';

const linter = new Linter({ configType: 'flat' });
const lint = (code: string, legacy: string[] = []) =>
  linter.verify(
    code,
    [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tseslint.parser },
        plugins: { o: { rules: { 'no-core-outside-operation': rule } } },
        rules: { 'o/no-core-outside-operation': ['error', { legacy }] },
      },
    ],
    { filename: 'f.ts' },
  );

describe('simplycms-ops/no-core-outside-operation (І25)', () => {
  it.each<[string, string, string[]?]>([
    ['withStorefrontDb дозволений', `withStorefrontDb((db) => load(db));`],
    [
      '*In не з impl — не чіпаємо',
      `import { listIn } from 'other'; listIn(x);`,
    ],
    [
      'legacy-ім’я може кликати runAdmin',
      `export const old = createServerFn().handler(async () => runAdmin(x));`,
      ['old'],
    ],
  ])('легально: %s', (_n, code, legacy) =>
    expect(lint(code, legacy)).toEqual([]),
  );

  it.each<[string, string, string[]?]>([
    ['withActor', `withActor({ role: 'a' }, (db) => db);`],
    ['runAdmin', `export const n = f(() => runAdmin(x));`],
    ['runAdminTransactions', `runAdminTransactions(x);`],
    [
      '*In з admin-server/impl',
      `import { listProductsIn } from 'simplycms/admin-server/impl'; listProductsIn(db);`,
    ],
    [
      '*In з impl під аліасом',
      `import { listProductsIn as q } from 'simplycms/admin-server/impl'; q(db);`,
    ],
    [
      'аліас withActor з simplycms/db',
      `import { withActor as wa } from 'simplycms/db'; wa(x, f);`,
    ],
    [
      'namespace impl: impl.listProductsIn(db)',
      `import * as impl from 'simplycms/admin-server/impl'; impl.listProductsIn(db);`,
    ],
    [
      'namespace db: ns.withActor()',
      `import * as dbm from 'simplycms/db'; dbm.withActor(x, f);`,
    ],
    ['метод db.withActor(...)', `db.withActor(x, f);`],
    ['перепризначення const w = withActor', `const w = withActor; w(x, f);`],
    [
      'перепризначення аліаса імпорту',
      `import { withActor as wa } from 'simplycms/db'; const w = wa; w(x, f);`,
    ],
    [
      'деструктуризація namespace',
      `import * as impl from 'simplycms/admin-server/impl'; const { runAdmin: r } = impl; r(x);`,
    ],
    [
      'обчислюваний доступ ns["fnIn"]',
      `import * as impl from 'simplycms/admin-server/impl'; impl['listProductsIn'](db);`,
    ],
    [
      'не-legacy ім’я в файлі serverFn',
      `export const fresh = createServerFn().handler(async () => runAdmin(x));`,
      ['old'],
    ],
  ])('офендер: %s', (_n, code, legacy) => {
    const msgs = lint(code, legacy);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.message).toMatch(/поза операцією/);
  });
});
