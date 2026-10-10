// БД харнес-тесту ядер адмінки (showcase Task 3): канон + демо-сід (облік
// залишку зі списанням, `decrease_on_order = true`) → app_runtime → afterAll
// із closeDbPool() ПЕРШИМ. Шапка — патерн admin-orders.test.ts.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { resolveHarness } from '../../up.mjs';
import * as H from '../../apply.mjs';
import { orderInput, placeOrder } from './orders';

const MIGRATIONS = join(import.meta.dirname, '../../../../migrations');

export const CONFIRMED = '00000001-0000-4000-8000-000000000002';
export const CANCELLED = '00000001-0000-4000-8000-000000000006';

/** Прибирає з рядків ключі, що законно різняться між двійниками. */
export const strip = (rows: object[], keys: string[]) =>
  rows.map((r) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k))),
  );

export function useCoresDb(prefix: string) {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = H.randomDbName(prefix);
  let url = '';
  const ids = { retail: '', point: '', method: '' };
  const one = async <T>(sql: string, p: unknown[] = []) =>
    ((await H.queryRows(url, sql, p)) as T[])[0]!;
  const id = async (sql: string, p: unknown[] = []) =>
    (await one<{ id: string }>(sql, p)).id;
  const product = (slug: string) =>
    id(`select id from public.products where slug = $1`, [slug]);

  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, dbName);
    url = H.withDbName(harness.url, dbName);
    const canon = readdirSync(MIGRATIONS)
      .filter((n) => n.endsWith('.sql'))
      .sort()
      .map((n) => join(MIGRATIONS, n));
    await H.applySqlFiles(url, [
      ...canon,
      join(MIGRATIONS, 'demo/demo-seed.sql'),
    ]);
    ids.retail = await id(
      `select id from public.price_types where code = 'retail'`,
    );
    ids.point = await id(
      `select id from public.pickup_points where name = 'Склад у Києві'`,
    );
    ids.method = await id(
      `select id from public.shipping_methods where code = 'pickup'`,
    );
    process.env.DATABASE_URL = H.withUser(url, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (url) await H.dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  return {
    url: () => url,
    ids,
    one,
    product,
    /** Оформлення воронкою вітрини (самовивіз), повертає id замовлення. */
    place: (productId: string, quantity: number) =>
      placeOrder(orderInput(ids.method, ids.point, [{ productId, quantity }])),
    /** Кількість на демо-точці для товару без модифікацій. */
    stock: async (productId: string) =>
      (
        await one<{ q: number }>(
          `select quantity as q from public.stock_by_pickup_point
            where product_id = $1 and pickup_point_id = $2`,
          [productId, ids.point],
        )
      ).q,
  };
}
