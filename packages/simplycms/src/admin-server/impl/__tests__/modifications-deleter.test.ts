// М1 Task 14, фікс-раунд 4: рядки `product_modifications` видаляє лише
// `deleteModifications` (`FOR UPDATE ... ORDER BY id`, потім DELETE) — ієрархія
// замків агрегата, пункт (4) у `products/aggregate/lock-order.ts`. Видаляч повз хелпер узяв
// би рядки в порядку плану й знову зустрівся б із `languages.fill` у протилежному
// порядку (40P01). Сканер — по всьому `src`, без тестів.
import { describe, expect, it } from 'vitest';
import type { ActorDb } from 'simplycms/db';
import { productModifications } from 'simplycms/schema';
import { removeResourceRows } from '../resource-write';
import { tableNames } from './support/table-names';

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

/** DELETE за іменем таблиці БД у сирому SQL (будь-які лапки/схема, `only`). */
const RAW_DELETE =
  /delete\s+from\s+(?:only\s+)?(?:"?public"?\s*\.\s*)?"?product_modifications"?(?![\w])/i;

/** DELETE через об'єкт таблиці під будь-яким іменем модуля (`tableNames`). */
const deletesVia = (src: string) =>
  tableNames(src, 'productModifications').some((name) =>
    [
      `\\.delete\\(\\s*${name}\\s*,?\\s*\\)`,
      `removeResourceRows\\(\\s*\\w+\\s*,\\s*${name}\\b`,
      `delete\\s+from\\s+(?:only\\s+)?\\$\\{\\s*${name}\\s*\\}`,
    ].some((re) => new RegExp(re, 'i').test(src)),
  );

const offenders = (files: Record<string, string>) =>
  Object.entries(files)
    .filter(
      ([path, src]) =>
        path !== HELPER && (RAW_DELETE.test(src) || deletesVia(src)),
    )
    .map(([path]) => path);

describe('єдиний видаляч модифікацій (М1, Task 14)', () => {
  const files = Object.fromEntries(
    Object.entries(sources).map(([k, v]) => [rel(k), v]),
  );

  it('сканер бачить хелпер (інакше glob порожній і тест нічого не доводить)', () => {
    expect(deletesVia(files[HELPER] ?? '')).toBe(true);
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
      'import-alias.ts':
        "import { productModifications as pm } from 'simplycms/schema';\nawait db.delete(pm).where(x)",
      'interp.ts': 'sql`delete from ${productModifications} where id = ${id}`',
      'interp-alias.ts':
        "import { productModifications as pm } from 'x';\nsql`DELETE FROM ${pm} WHERE x`",
    };
    expect(offenders(forms)).toEqual(Object.keys(forms));
    expect(
      offenders({
        'ok.ts': 'sql`delete from public.product_modifications_x`',
        'ok2.ts': 'await db.delete(productModificationsOther).where(x)',
      }),
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
