// Демо-сід (`migrations/demo/demo-seed.sql`) поверх канону — доказ, що
// «магазин видно» не протухає разом зі схемою.
//
// 🔴 Демо НЕ є частиною канону (склад канону — рівно 4 файли, `baseline.test.ts`
// стереже це число), тож тут своя тимчасова БД і свій накат: канон + демо
// одним списком. Ідемпотентність — та сама вимога, що й для канону: докат
// файлу вдруге не має міняти лічильники (демо-файл теж описує це в шапці).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
} from '../apply.mjs';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');
const DEMO_FILE = join(MIGRATIONS_DIR, 'demo/demo-seed.sql');

/** Канон у порядку імен + демо-сід останнім — той самий порядок, що й `demo-db.mjs`. */
const filesToApply = (): string[] => [
  ...readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS_DIR, name)),
  DEMO_FILE,
];

describe('демо-сід: накат поверх канону', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_demo_seed');
  let dbUrl: string;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, filesToApply());
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const counts = async () => ({
    sections: (await queryRows(dbUrl, 'select id from public.sections')).length,
    products: (await queryRows(dbUrl, 'select id from public.products')).length,
    prices: (await queryRows(dbUrl, 'select id from public.product_prices'))
      .length,
    modifications: (
      await queryRows(dbUrl, 'select id from public.product_modifications')
    ).length,
    banners: (await queryRows(dbUrl, 'select id from public.banners')).length,
  });

  it('накатується без помилок і дає непорожній каталог', async () => {
    const c = await counts();
    expect(c.sections).toBeGreaterThanOrEqual(3);
    expect(c.products).toBeGreaterThanOrEqual(6);
    expect(c.products).toBeLessThanOrEqual(10);
    expect(c.prices).toBeGreaterThan(0);
    expect(c.modifications).toBeGreaterThan(0);
    expect(c.banners).toBeGreaterThan(0);
  });

  it('дерево секцій: є батьківська й дочірні', async () => {
    const roots = await queryRows(
      dbUrl,
      'select slug from public.sections where parent_id is null order by slug',
    );
    const children = await queryRows(
      dbUrl,
      'select slug from public.sections where parent_id is not null',
    );
    expect(roots.length).toBeGreaterThanOrEqual(2);
    expect(children.length).toBeGreaterThanOrEqual(2);
  });

  it("усі активні товари прив'язані до секцій і мають ціну", async () => {
    const orphanProducts = await queryRows(
      dbUrl,
      `select slug from public.products where is_active and section_id is null`,
    );
    expect(orphanProducts).toHaveLength(0);

    const withoutPrice = await queryRows(
      dbUrl,
      `select p.slug from public.products p
        where p.is_active
          and not exists (
            select 1 from public.product_prices pp where pp.product_id = p.id
          )`,
    );
    expect(withoutPrice).toHaveLength(0);
  });

  it('демо не містить персональних даних чи замовлень', async () => {
    for (const table of [
      'orders',
      'order_items',
      'profiles',
      'users',
      'user_addresses',
      'user_recipients',
    ]) {
      const rows = await queryRows(dbUrl, `select 1 from public.${table}`);
      expect(rows).toHaveLength(0);
    }
  });

  it('ідемпотентний: повторний докат демо-файлу не міняє лічильники', async () => {
    const before = await counts();
    await applySqlFiles(dbUrl, [DEMO_FILE]);
    expect(await counts()).toEqual(before);
  }, 60_000);
});
