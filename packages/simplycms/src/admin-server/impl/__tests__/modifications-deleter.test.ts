// М1 Task 14, фікс-раунд 4: рядки `product_modifications` видаляє лише
// `deleteModifications` (`FOR UPDATE ... ORDER BY id`, потім DELETE) — ієрархія
// замків агрегата, пункт (б) у `products/aggregate/load.ts`. Видаляч повз хелпер узяв
// би рядки в порядку плану й знову зустрівся б із `languages.fill` у протилежному
// порядку (40P01). Сканер — по всьому `src`, без тестів.
import { describe, expect, it } from 'vitest';

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

/** Прямий DELETE модифікацій: сирий SQL, Drizzle `.delete(...)`, узагальнений видаляч. */
const DELETERS = [
  /delete\s+from\s+(?:public\s*\.\s*)?"?product_modifications"?(?![\w])/i,
  /\.delete\(\s*(?:\w+\.)?productModifications\s*\)/,
  /removeResourceRows\(\s*\w+\s*,\s*(?:\w+\.)?productModifications\b/,
];

const offenders = (files: Record<string, string>) =>
  Object.entries(files)
    .filter(
      ([path, src]) => path !== HELPER && DELETERS.some((re) => re.test(src)),
    )
    .map(([path]) => path);

describe('єдиний видаляч модифікацій (М1, Task 14)', () => {
  const files = Object.fromEntries(
    Object.entries(sources).map(([k, v]) => [rel(k), v]),
  );

  it('сканер бачить хелпер (інакше glob порожній і тест нічого не доводить)', () => {
    expect(files[HELPER]).toMatch(DELETERS[1]!);
  });

  it('негативний контроль: кожен шаблон ловить свого видаляча', () => {
    expect(
      offenders({
        'a.ts': 'sql`delete from public.product_modifications where id = 1`',
        'b.ts': 'await db.delete(productModifications).where(x)',
        'c.ts': 'removeResourceRows(db, productModifications, ids)',
      }),
    ).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('DELETE модифікацій у src — лише в deleteModifications', () => {
    expect(offenders(files)).toEqual([]);
  });
});
