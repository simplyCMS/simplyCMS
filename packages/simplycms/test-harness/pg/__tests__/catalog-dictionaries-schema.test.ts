// Е4-1, Е4-6: правка baseline довідників каталогу.
//  - FK цін за типом ціни — ON DELETE RESTRICT (тип із цінами не зникає разом
//    із цінами мовчки);
//  - slug властивості унікальний ГЛОБАЛЬНО (вітрина шукає властивість лише за
//    slug), а не в межах розділу.
//
// 🔴 app_runtime не потрібен: перевіряється сам DDL — привілейоване
// підключення dbUrl, як у property-values-multiselect.test.ts.
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

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');

/** Канон у порядку імен — той самий список, що й у baseline.test.ts. */
const canonFiles = (): string[] =>
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS, name));

const S1 = 'e4010000-0000-4000-8000-000000000001';
const S2 = 'e4010000-0000-4000-8000-000000000002';
const PT_USED = 'e4010000-0000-4000-8000-000000000003';
const PT_FREE = 'e4010000-0000-4000-8000-000000000004';
const PRODUCT = 'e4010000-0000-4000-8000-000000000005';
const PRICE = 'e4010000-0000-4000-8000-000000000006';

describe('довідники каталогу: інваріанти baseline (Е4-1, Е4-6)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_catalog_dictionaries');
  let dbUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());

    await queryRows(
      dbUrl,
      `insert into public.sections (id, slug, name) values
         ($1, 'e4-1-s1', 'Розділ 1'), ($2, 'e4-1-s2', 'Розділ 2')`,
      [S1, S2],
    );
    await queryRows(
      dbUrl,
      `insert into public.price_types (id, name, code) values
         ($1, 'Гурт', 'e4-wholesale'), ($2, 'Без цін', 'e4-free')`,
      [PT_USED, PT_FREE],
    );
    await queryRows(
      dbUrl,
      `insert into public.products (id, section_id, slug, name) values ($1, $2, 'e4-1-product', 'Товар Е4-1')`,
      [PRODUCT, S1],
    );
    await queryRows(
      dbUrl,
      `insert into public.product_prices (id, price_type_id, product_id, price) values ($1, $2, $3, 100)`,
      [PRICE, PT_USED, PRODUCT],
    );
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const insertProperty = (sectionId: string | null, slug: string) =>
    queryRows(
      dbUrl,
      `insert into public.section_properties (id, section_id, name, slug, property_type)
       values (gen_random_uuid(), $1, 'Властивість', $2, 'text')`,
      [sectionId, slug],
    );

  it('тип ціни з цінами не видаляється — 23503, ціни цілі', async () => {
    await expect(
      queryRows(dbUrl, 'delete from public.price_types where id = $1', [
        PT_USED,
      ]),
    ).rejects.toMatchObject({ code: '23503' });
    const [{ n }] = await queryRows(
      dbUrl,
      'select count(*)::int n from public.product_prices where price_type_id = $1',
      [PT_USED],
    );
    expect(n).toBe(1);
  });

  it('тип ціни без цін видаляється', async () => {
    await queryRows(dbUrl, 'delete from public.price_types where id = $1', [
      PT_FREE,
    ]);
    const [{ n }] = await queryRows(
      dbUrl,
      'select count(*)::int n from public.price_types where id = $1',
      [PT_FREE],
    );
    expect(n).toBe(0);
  });

  it('дві глобальні властивості з однаковим slug — 23505', async () => {
    await insertProperty(null, 'kolir');
    await expect(insertProperty(null, 'kolir')).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('той самий slug у різних розділах — теж 23505 (вітрина шукає лише за slug)', async () => {
    await insertProperty(S1, 'vaga');
    await expect(insertProperty(S2, 'vaga')).rejects.toMatchObject({
      code: '23505',
    });
  });
});
