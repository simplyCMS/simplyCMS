// М1 Task 14, фікс-раунд 5: рядкові замки `products` сильніші за KEY SHARE (`NO KEY
// UPDATE`, `UPDATE`) бере лише `lockAggregateRoots` — він сам бере спільний
// `languages-set` ПЕРЕД коренем (`products/aggregate/lock-order.ts`, пункт (1)). Замок
// кореня повз хелпер повернув би порядок «корінь -> set» і цикл 40P01 з `languages.remove`.
import { describe, expect, it } from 'vitest';
import { tableNames } from './support/table-names';

const sources = import.meta.glob(
  ['../../../**/*.{ts,tsx}', '!../../../**/__tests__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

const rel = (key: string) =>
  new URL(key, 'file:///src/admin-server/impl/__tests__/').pathname.replace(
    '/src/',
    '',
  );

const HELPER = 'admin-server/impl/products/aggregate/lock-order.ts';

/** Замок кореня в сирому SQL за іменем таблиці БД; DELETE — неявний FOR UPDATE. */
const RAW_LOCKS = [
  /from\s+(?:only\s+)?(?:"?public"?\s*\.\s*)?"?products"?(?![\w])[^;`]*?\bfor\s+(?:no\s+key\s+)?update\b/i,
  /delete\s+from\s+(?:only\s+)?(?:"?public"?\s*\.\s*)?"?products"?(?![\w])/i,
];

/** Замок через об'єкт таблиці під будь-яким іменем модуля (`tableNames`). */
const locksVia = (src: string) =>
  tableNames(src, 'products').some((name) =>
    [
      `\\.from\\(\\s*${name}\\s*\\)[^;]*?\\.for\\(\\s*['"](?:no key update|update)['"]`,
      `from\\s+(?:only\\s+)?\\$\\{\\s*${name}\\s*\\}[^;\`]*?\\bfor\\s+(?:no\\s+key\\s+)?update\\b`,
      `delete\\s+from\\s+(?:only\\s+)?\\$\\{\\s*${name}\\s*\\}`,
    ].some((re) => new RegExp(re, 'i').test(src)),
  );

const offenders = (files: Record<string, string>) =>
  Object.entries(files)
    .filter(
      ([path, src]) =>
        path !== HELPER &&
        (RAW_LOCKS.some((re) => re.test(src)) || locksVia(src)),
    )
    .map(([path]) => path);

describe('замок кореня агрегата — лише lockAggregateRoots (М1, Task 14)', () => {
  const files = Object.fromEntries(
    Object.entries(sources).map(([k, v]) => [rel(k), v]),
  );

  it('хелпер бере set перед рядком кореня (позитивний контроль сканера)', () => {
    const src = files[HELPER] ?? '';
    expect(src).toMatch(/\.from\(products\)[^;]*\.for\(strength\)/);
    expect(src.indexOf('advisoryXactLockShared(db')).toBeLessThan(
      src.indexOf('.from(products)'),
    );
  });

  it('негативний контроль: кожна форма замка ловиться', () => {
    const forms: Record<string, string> = {
      'nku.ts':
        "await db.select().from(products)\n  .where(x)\n  .for('no key update');",
      'upd.ts': "db.select().from(schema.products).for('update')",
      'raw.ts': 'sql`select 1 from public.products where id = $1 for update`',
      'rawnk.ts':
        'sql`select id from "public"."products" where id = any($1)\n order by id for no key update`',
      'import-alias.ts':
        "import { products as p } from 'simplycms/schema';\ndb.select().from(p).for('update')",
      'local-alias.ts':
        "const t = products;\ndb.select().from(t).for('no key update')",
      'interp.ts': 'sql`select 1 from ${products} where id = ${id} for update`',
      'interp-alias.ts':
        "import { products as p } from 'x';\nsql`select 1 from ${p} for no key update`",
      'raw-delete.ts': 'sql`delete from public.products where id = ${id}`',
      'interp-delete.ts': 'sql`DELETE FROM ${products} WHERE id = ${id}`',
    };
    expect(offenders(forms)).toEqual(Object.keys(forms));
    expect(
      offenders({
        'ks.ts': "db.select().from(products).for('key share')",
        'other.ts': "db.select().from(productsOther).for('update')",
      }),
    ).toEqual([]);
  });

  it('у src рядкові замки коренів — лише в lockAggregateRoots', () => {
    expect(offenders(files)).toEqual([]);
  });
});
