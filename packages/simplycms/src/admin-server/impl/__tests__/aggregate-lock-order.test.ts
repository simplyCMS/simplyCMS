// М1 Task 14, фікс-раунд 5; М2б Д8/Р19: рядкові замки КОЖНОГО кореня агрегата (`products`,
// `order_statuses`, …) сильніші за KEY SHARE (`NO KEY UPDATE`, `UPDATE`) бере лише спільний
// `lockRoots` (`translatable/roots.ts`) — він сам бере спільний `languages-set` ПЕРЕД коренем,
// а товарний `lockAggregateRoots` лише делегує йому (`products/aggregate/lock-order.ts`,
// пункт (1)). Замок кореня повз хелпер повернув би порядок «корінь -> set» і цикл 40P01 з
// `languages.remove`. Перелік коренів звіряється з оголошеними `AggregateRoot` нижче.
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

const HELPER = 'admin-server/impl/translatable/roots.ts';
const PRODUCT_LOCKS = 'admin-server/impl/products/aggregate/lock-order.ts';

/** Корені агрегатів: ім'я таблиці БД й ідентифікатор Drizzle (кожен `AggregateRoot` — тут). */
const ROOTS = [
  { sql: 'products', ident: 'products' },
  { sql: 'order_statuses', ident: 'orderStatuses' },
] as const;

/** Замок кореня в сирому SQL за іменем таблиці БД; DELETE — неявний FOR UPDATE. */
const RAW_LOCKS = ROOTS.flatMap(({ sql }) => [
  new RegExp(
    `from\\s+(?:only\\s+)?(?:"?public"?\\s*\\.\\s*)?"?${sql}"?(?![\\w])[^;\`]*?\\bfor\\s+(?:no\\s+key\\s+)?update\\b`,
    'i',
  ),
  new RegExp(
    `delete\\s+from\\s+(?:only\\s+)?(?:"?public"?\\s*\\.\\s*)?"?${sql}"?(?![\\w])`,
    'i',
  ),
]);

/** Замок через об'єкт таблиці під будь-яким іменем модуля (`tableNames`). */
const locksVia = (src: string) =>
  ROOTS.flatMap(({ ident }) => tableNames(src, ident)).some((name) =>
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

describe('замок кореня агрегата — лише lockRoots (М1 Task 14, М2б Д8)', () => {
  const files = Object.fromEntries(
    Object.entries(sources).map(([k, v]) => [rel(k), v]),
  );

  it('хелпер бере set перед рядком кореня (позитивний контроль сканера)', () => {
    const src = files[HELPER] ?? '';
    expect(src).toMatch(/\.orderBy\(root\.id\)[^;]*\.for\(strength\)/);
    expect(src.indexOf('advisoryXactLockShared(db')).toBeGreaterThan(-1);
    expect(src.indexOf('advisoryXactLockShared(db')).toBeLessThan(
      src.indexOf('.for(strength)'),
    );
  });

  it('товарний lockAggregateRoots делегує lockRoots і не має власного .for(', () => {
    const src = files[PRODUCT_LOCKS] ?? '';
    expect(src).toMatch(/lockRoots\(\s*db,\s*PRODUCT_ROOT/);
    expect(src).not.toMatch(/\.for\(/);
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

  it('кожен оголошений AggregateRoot є в переліку сканера (нова сутність не прослизне)', () => {
    const declared = Object.values(files).flatMap((src) =>
      [...src.matchAll(/:\s*AggregateRoot\s*=\s*\{\s*table:\s*(\w+)/g)].map(
        (m) => m[1],
      ),
    );
    expect(declared.sort()).toEqual(ROOTS.map((r) => r.ident).sort());
  });

  it('негативний контроль статусів: сирий .for( на order_statuses у файлі команди — червоний', () => {
    expect(
      offenders({
        'order-statuses/bad.ts':
          "await db.select().from(orderStatuses).where(x).for('update');",
        'order-statuses/bad-sql.ts':
          'sql`select 1 from public.order_statuses where id = ${id} for no key update`',
      }),
    ).toEqual(['order-statuses/bad.ts', 'order-statuses/bad-sql.ts']);
  });
});
