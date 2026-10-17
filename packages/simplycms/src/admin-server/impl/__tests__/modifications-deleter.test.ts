// М1 Task 14, фікс-раунд 4: рядки `product_modifications` видаляє лише
// `deleteModifications` (`FOR UPDATE ... ORDER BY id`, потім DELETE) — ієрархія
// замків агрегата, пункт (4) у `products/aggregate/lock-order.ts`. Видаляч повз хелпер узяв
// би рядки в порядку плану й знову зустрівся б із `languages.fill` у протилежному
// порядку (40P01). Сканер — по всьому `src`, без тестів.
import { describe, expect, it } from 'vitest';
import type { ActorDb } from 'simplycms/db';
import { productModifications } from 'simplycms/schema';
import { removeResourceRows } from '../resource-write';

const sources = import.meta.glob(
  ['../../../**/*.{ts,tsx}', '!../../../**/__tests__/**'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** Ключ glob (відносно `__tests__`) → шлях від `src/`. */
const rel = (key: string) =>
  new URL(key, 'file:///src/admin-server/impl/__tests__/').pathname.replace(
    '/src/',
    '',
  );

const HELPER = 'admin-server/impl/product-modifications/delete.ts';

/** Прямий DELETE модифікацій: сирий SQL (будь-які лапки/схема), Drizzle, узагальнений видаляч. */
const DELETERS = [
  /delete\s+from\s+(?:only\s+)?(?:"?public"?\s*\.\s*)?"?product_modifications"?(?![\w])/i,
  /\.delete\(\s*(?:\w+\.)?productModifications\s*,?\s*\)/,
  /removeResourceRows\(\s*\w+\s*,\s*(?:\w+\.)?productModifications\b/,
];

/** Аліаси таблиці (`const m = productModifications`) і `.delete(m)` через них. */
const aliasDelete = (src: string) =>
  [
    ...src.matchAll(
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:\w+\.)?productModifications\b/g,
    ),
  ].some(([, alias]) =>
    new RegExp(`\\.delete\\(\\s*${alias}\\s*,?\\s*\\)`).test(src),
  );

const offenders = (files: Record<string, string>) =>
  Object.entries(files)
    .filter(
      ([path, src]) =>
        path !== HELPER &&
        (DELETERS.some((re) => re.test(src)) || aliasDelete(src)),
    )
    .map(([path]) => path);

describe('єдиний видаляч модифікацій (М1, Task 14)', () => {
  const files = Object.fromEntries(
    Object.entries(sources).map(([k, v]) => [rel(k), v]),
  );

  it('сканер бачить хелпер (інакше glob порожній і тест нічого не доводить)', () => {
    expect(files[HELPER]).toMatch(DELETERS[1]!);
  });

  it('негативний контроль: кожна форма видалення ловиться', () => {
    const forms: Record<string, string> = {
      'raw.ts': 'sql`delete from public.product_modifications where id = 1`',
      'quoted.ts': 'sql`DELETE FROM "public"."product_modifications" WHERE x`',
      'bare.ts':
        'sql`delete from product_modifications where product_id = ${p}`',
      'only.ts': 'sql`delete from only public.product_modifications`',
      'drizzle.ts': 'await db.delete(productModifications).where(x)',
      'multiline.ts':
        'await db\n  .delete(\n    productModifications,\n  )\n  .where(x)',
      'ns.ts': 'await db.delete(schema.productModifications).where(x)',
      'alias.ts':
        'const m = productModifications;\nawait db.delete(m).where(x)',
      'generic.ts': 'removeResourceRows(db, productModifications, ids)',
    };
    expect(offenders(forms)).toEqual(Object.keys(forms));
    expect(
      offenders({ 'ok.ts': 'sql`delete from public.product_modifications_x`' }),
    ).toEqual([]);
  });

  it('DELETE модифікацій у src — лише в deleteModifications', () => {
    expect(offenders(files)).toEqual([]);
  });

  it('ресурс модифікацій видаляє через хелпер (хук `deleteRows`)', () => {
    expect(
      files['admin-server/impl/product-modifications/resource.ts'],
    ).toMatch(/deleteRows:\s*\([^)]*\)\s*=>\s*deleteModifications\(/);
  });

  it('узагальнений DELETE фабрики відмовляє на product_modifications', async () => {
    const db = {} as ActorDb;
    await expect(
      removeResourceRows(db, productModifications, ['x']),
    ).rejects.toThrow(/deleteModifications/);
  });
});
