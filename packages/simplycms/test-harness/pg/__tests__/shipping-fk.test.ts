// Е6а-17: залишки не губляться видаленням — гарантує БД, а не перевірка в коді.
// FK `pickup_points.method_id` і `stock_by_pickup_point.pickup_point_id` — RESTRICT:
// спосіб із точками й точку з будь-яким рядком залишку (і з нульовим) база не
// видаляє (23503). Каскад раніше знищував склад мовчки.
//
// 🔴 Привілейоване підключення: перевіряється сам DDL, як у
// catalog-dictionaries-schema.test.ts.
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

const METHOD = 'e6a10000-0000-4000-8000-000000000001';
const POINT_STOCK = 'e6a10000-0000-4000-8000-000000000002';
const POINT_ZERO = 'e6a10000-0000-4000-8000-000000000003';
const POINT_FREE = 'e6a10000-0000-4000-8000-000000000004';
const SECTION = 'e6a10000-0000-4000-8000-000000000005';
const PRODUCT = 'e6a10000-0000-4000-8000-000000000006';
// Точки БЕЗ залишку: інакше RESTRICT залишку маскує cascade FK способу (мутація Task 4).
const METHOD_BARE = 'e6a10000-0000-4000-8000-000000000007';
const POINT_BARE = 'e6a10000-0000-4000-8000-000000000008';

describe('доставка: FK RESTRICT (Е6а-17)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_shipping_fk');
  let dbUrl = '';

  const count = async (sql: string, id: string): Promise<number> => {
    const [{ n }] = await queryRows(dbUrl, sql, [id]);
    return n as number;
  };

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, canonFiles());

    await queryRows(
      dbUrl,
      `insert into public.shipping_methods (id, code, name, provider)
       values ($1, 'e6a-pickup', 'Самовивіз Е6а', 'core:pickup'),
              ($2, 'e6a-pickup-bare', 'Самовивіз без залишків', 'core:pickup')`,
      [METHOD, METHOD_BARE],
    );
    await queryRows(
      dbUrl,
      `insert into public.pickup_points (id, method_id, name, address, city) values
         ($1, $4, 'З залишком', 'вул. А, 1', 'Київ'),
         ($2, $4, 'З нульовим', 'вул. Б, 2', 'Київ'),
         ($3, $4, 'Порожня', 'вул. В, 3', 'Київ'),
         ($5, $6, 'Без залишку', 'вул. Г, 4', 'Київ')`,
      [POINT_STOCK, POINT_ZERO, POINT_FREE, METHOD, POINT_BARE, METHOD_BARE],
    );
    await queryRows(
      dbUrl,
      `insert into public.sections (id, slug, name) values ($1, 'e6a-fk', 'Розділ')`,
      [SECTION],
    );
    await queryRows(
      dbUrl,
      `insert into public.products (id, section_id, slug, name) values ($1, $2, 'e6a-fk-product', 'Товар')`,
      [PRODUCT, SECTION],
    );
    await queryRows(
      dbUrl,
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, quantity)
       select gen_random_uuid(), p.id, $3, p.q
         from (values ($1::uuid, 5), ($2::uuid, 0)) as p(id, q)`,
      [POINT_STOCK, POINT_ZERO, PRODUCT],
    );
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it.each([
    ['із залишками на точках', METHOD, 3],
    ['з точкою без рядків залишку', METHOD_BARE, 1],
  ])(
    'спосіб %s не видаляється — 23503, точки цілі',
    async (_label, methodId, points) => {
      await expect(
        queryRows(dbUrl, 'delete from public.shipping_methods where id = $1', [
          methodId,
        ]),
      ).rejects.toMatchObject({ code: '23503' });
      expect(
        await count(
          'select count(*)::int n from public.pickup_points where method_id = $1',
          methodId,
        ),
      ).toBe(points);
    },
  );

  it.each([
    ['з залишком', POINT_STOCK, 5],
    ['з нульовим рядком залишку', POINT_ZERO, 0],
  ])(
    'точка %s не видаляється — 23503, залишок цілий',
    async (_label, pointId, qty) => {
      await expect(
        queryRows(dbUrl, 'delete from public.pickup_points where id = $1', [
          pointId,
        ]),
      ).rejects.toMatchObject({ code: '23503' });
      const [{ q }] = await queryRows(
        dbUrl,
        'select quantity q from public.stock_by_pickup_point where pickup_point_id = $1',
        [pointId],
      );
      expect(q).toBe(qty);
    },
  );

  it('точка без рядків залишку видаляється', async () => {
    await queryRows(dbUrl, 'delete from public.pickup_points where id = $1', [
      POINT_FREE,
    ]);
    expect(
      await count(
        'select count(*)::int n from public.pickup_points where id = $1',
        POINT_FREE,
      ),
    ).toBe(0);
  });
});
