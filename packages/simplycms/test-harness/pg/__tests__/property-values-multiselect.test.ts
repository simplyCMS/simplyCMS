// Е3-13: значення властивостей — рядок на опцію. Правка baseline (рамка
// B13, як К3-14): унікальність стає (власник, property_id, option_id)
// NULLS NOT DISTINCT — скалярна властивість лишається ОДНИМ рядком
// (option_id NULL не дублюється), multiselect дає рядок на КОЖНУ опцію.
//
// 🔴 app_runtime тут не потрібен: тест перевіряє сам DDL (обмеження
// унікальності), а не RLS чи грант ролі — привілейоване підключення
// dbUrl, як у single-default.test.ts.
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

const SECTION = 'e3130000-0000-4000-8000-000000000001';
const PROP_SCALAR = 'e3130000-0000-4000-8000-000000000002';
const PROP_MULTI = 'e3130000-0000-4000-8000-000000000003';
const OPT_A = 'e3130000-0000-4000-8000-000000000004';
const OPT_B = 'e3130000-0000-4000-8000-000000000005';
const PRODUCT = 'e3130000-0000-4000-8000-000000000006';
const MODIFICATION = 'e3130000-0000-4000-8000-000000000007';

describe('Е3-13: multiselect — рядок на опцію (NULLS NOT DISTINCT)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_property_values_multiselect');
  let dbUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());

    await queryRows(
      dbUrl,
      `insert into public.sections (id, slug, name) values ($1, 'e3-13-section', 'Розділ Е3-13')`,
      [SECTION],
    );
    await queryRows(
      dbUrl,
      `insert into public.section_properties (id, section_id, name, slug, property_type)
       values ($1, $2, 'Потужність', 'e3-13-power', 'text'),
              ($3, $2, 'Колір', 'e3-13-color', 'multiselect')`,
      [PROP_SCALAR, SECTION, PROP_MULTI],
    );
    await queryRows(
      dbUrl,
      `insert into public.property_options (id, property_id, name, slug)
       values ($1, $3, 'Чорний', 'e3-13-black'),
              ($2, $3, 'Білий', 'e3-13-white')`,
      [OPT_A, OPT_B, PROP_MULTI],
    );
    await queryRows(
      dbUrl,
      `insert into public.products (id, section_id, slug, name) values ($1, $2, 'e3-13-product', 'Товар Е3-13')`,
      [PRODUCT, SECTION],
    );
    await queryRows(
      dbUrl,
      `insert into public.product_modifications (id, product_id, slug, name) values ($1, $2, 'e3-13-mod', 'Модифікація Е3-13')`,
      [MODIFICATION, PRODUCT],
    );
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const insertProductValue = (
    propertyId: string,
    optionId: string | null,
    value: string,
  ) =>
    queryRows(
      dbUrl,
      `insert into public.product_property_values (id, product_id, property_id, option_id, value)
       values (gen_random_uuid(), $1, $2, $3, $4)`,
      [PRODUCT, propertyId, optionId, value],
    );

  const insertModificationValue = (
    propertyId: string,
    optionId: string | null,
    value: string,
  ) =>
    queryRows(
      dbUrl,
      `insert into public.modification_property_values (id, modification_id, property_id, option_id, value)
       values (gen_random_uuid(), $1, $2, $3, $4)`,
      [MODIFICATION, propertyId, optionId, value],
    );

  it('product_property_values: скалярна властивість — рівно один рядок (option_id NULL не дублюється)', async () => {
    await insertProductValue(PROP_SCALAR, null, '100');
    await expect(
      insertProductValue(PROP_SCALAR, null, '200'),
    ).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('product_property_values: multiselect — рядок на кожну опцію; та сама опція двічі — 23505', async () => {
    await insertProductValue(PROP_MULTI, OPT_A, 'Чорний');
    await insertProductValue(PROP_MULTI, OPT_B, 'Білий');
    await expect(
      insertProductValue(PROP_MULTI, OPT_A, 'Чорний знову'),
    ).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('modification_property_values: скалярна властивість — рівно один рядок (option_id NULL не дублюється)', async () => {
    await insertModificationValue(PROP_SCALAR, null, '100');
    await expect(
      insertModificationValue(PROP_SCALAR, null, '200'),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('modification_property_values: multiselect — рядок на кожну опцію; та сама опція двічі — 23505', async () => {
    await insertModificationValue(PROP_MULTI, OPT_A, 'Чорний');
    await insertModificationValue(PROP_MULTI, OPT_B, 'Білий');
    await expect(
      insertModificationValue(PROP_MULTI, OPT_A, 'Чорний знову'),
    ).rejects.toMatchObject({ code: '23505' });
  });
});
