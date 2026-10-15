// Відбір характеристик розділу для клієнтських фільтрів каталогу (Ф1, Р5).
//
// 🔴 Лоадер мусить віддавати і числові (діапазон), і boolean («Так»)
// характеристики одним каналом; перелікові (select) — ні: їх панель бере з
// `loadSectionFilters`. Довести відбір можна лише живим SQL.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import {
  loadSectionFilterProperties,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applyCanon,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';

const SECTION_ID = '00000000-0000-4000-8000-0000000000a1';

/** Характеристика + призначення розділу; `filterable` керує негативним контролем. */
function property(
  n: number,
  slug: string,
  type: string,
  filterable = true,
): string[] {
  const id = `00000000-0000-4000-8000-0000000000b${n}`;
  return [
    `insert into public.section_properties (id, name, slug, property_type, is_filterable)
     values ('${id}', '${slug}', '${slug}', '${type}', ${filterable})`,
    `insert into public.section_property_assignments (id, section_id, property_id, sort_order)
     values (gen_random_uuid(), '${SECTION_ID}', '${id}', ${n})`,
  ];
}

describe('характеристики розділу для клієнтських фільтрів', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_filter_props');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applyCanon(dbUrl);
    const statements = [
      `insert into public.sections (id, name, slug, is_active)
       values ('${SECTION_ID}', 'Роутери', 'routers-fp', true)`,
      ...property(1, 'fp-power', 'number'),
      ...property(2, 'fp-wifi', 'boolean'),
      ...property(3, 'fp-kind', 'select'),
      ...property(4, 'fp-hidden-bool', 'boolean', false),
    ];
    for (const statement of statements) await queryRows(dbUrl, statement);
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('віддає number і boolean, але не select і не нефільтровні', async () => {
    const rows = await withStorefrontDb((db) =>
      loadSectionFilterProperties(db, SECTION_ID),
    );

    expect(rows.map((r) => [r.slug, r.property_type])).toEqual([
      ['fp-power', 'number'],
      ['fp-wifi', 'boolean'],
    ]);
    expect(rows[1].name).toBe('fp-wifi');
  });
});
