// БД харнес-тесту дельти залишку по позиції (К3-Е5б Task 2, Е5б-7′): канон +
// демо-сід; оформлення — воронкою вітрини, облік — під `app_admin` після
// `orders … FOR UPDATE` (Е5б-8). Залишок кожен тест задає сам — точні асерти.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll } from 'vitest';
import { closeDbPool, withActor, type ActorDb } from 'simplycms/db';
import { resolveHarness } from '../../up.mjs';
import * as H from '../../apply.mjs';
import { orderInput, placeOrder } from './orders';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../../migrations');
export const SLUGS = {
  panel: 'sonyachna-panel-450w-mono',
  panel2: 'sonyachna-panel-550w-mono',
  inverter: 'invertor-gibrydnyi-8kw',
  battery: 'akumulyator-lifepo4-200ah',
} as const;

type ItemState = {
  quantity: number;
  stockPointId: string | null;
  stockReserved: number;
};

export function useOrderItemStockDb(prefix: string) {
  const ids = { method: '', point: '' } as Record<string, string>;
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = H.randomDbName(prefix);
  let dbUrl = '';
  const rows = async <T>(text: string, p: unknown[] = []) =>
    (await H.queryRows(dbUrl, text, p)) as T[];
  const one = async <T>(text: string, p: unknown[] = []) =>
    (await rows<T>(text, p))[0]!;

  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, dbName);
    dbUrl = H.withDbName(harness.url, dbName);
    await H.applySqlFiles(dbUrl, [
      ...readdirSync(MIGRATIONS_DIR)
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => join(MIGRATIONS_DIR, n)),
      join(MIGRATIONS_DIR, 'demo/demo-seed.sql'),
    ]);
    const id = async (text: string, p: unknown[] = []) =>
      (await one<{ id: string }>(text, p)).id;
    ids.method = await id(
      `select id from public.shipping_methods where code = 'pickup'`,
    );
    ids.point = await id(`select id from public.pickup_points where is_system`);
    for (const [key, slug] of Object.entries(SLUGS))
      ids[key] = await id(`select id from public.products where slug = $1`, [
        slug,
      ]);
    process.env.DATABASE_URL = H.withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await H.dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  /** Облік цілі: рівно один рядок на системній точці (`untrack` — жодного). */
  const setStock = async (
    productId: string,
    qty: number,
    status = 'in_stock',
  ) => {
    await untrack(productId, status);
    await rows(
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, quantity)
       values (gen_random_uuid(), $1, $2, $3)`,
      [ids.point, productId, qty],
    );
  };
  const untrack = async (productId: string, status = 'in_stock') => {
    await rows(
      `delete from public.stock_by_pickup_point where product_id = $1`,
      [productId],
    );
    await rows(`update public.products set stock_status = $2 where id = $1`, [
      productId,
      status,
    ]);
  };
  const stock = async (productId: string) =>
    (
      await one<{ q: number }>(
        `select quantity as q from public.stock_by_pickup_point
          where product_id = $1 and pickup_point_id = $2`,
        [productId, ids.point],
      )
    ).q;
  const setToggle = (on: boolean) =>
    rows(
      `update public.system_settings set value = jsonb_build_object('decrease_on_order', $1::boolean)
        where key = 'stock_management'`,
      [on],
    );
  const order = (items: { productId: string; quantity: number }[]) =>
    placeOrder(orderInput(ids.method, ids.point, items));
  const itemOf = async (orderId: string, productId: string) =>
    (
      await one<{ id: string }>(
        `select id from public.order_items where order_id = $1 and product_id = $2`,
        [orderId, productId],
      )
    ).id;
  const item = (orderItemId: string) =>
    one<ItemState>(
      `select quantity, stock_point_id as "stockPointId", stock_reserved as "stockReserved"
         from public.order_items where id = $1`,
      [orderItemId],
    );
  /** Нова позиція так, як її вставляє операція (Е5б-8 крок 3). */
  const insertItem = async (orderId: string, productId: string, qty: number) =>
    (
      await one<{ id: string }>(
        `insert into public.order_items (id, order_id, product_id, name, price, quantity, total)
         values (gen_random_uuid(), $1, $2, 'Нова', 100, $3, 100 * $3) returning id`,
        [orderId, productId, qty],
      )
    ).id;
  /** Транзакція адміна з локом замовлення — як операції адмінки. */
  const admin = <T>(orderId: string, fn: (db: ActorDb) => Promise<T>) =>
    withActor({ role: 'app_admin' }, async (db) => {
      await db.execute(
        sql`select id from public.orders where id = ${orderId} for update`,
      );
      return fn(db);
    });

  return {
    ids,
    setStock,
    untrack,
    stock,
    setToggle,
    order,
    itemOf,
    item,
    insertItem,
    admin,
  };
}
