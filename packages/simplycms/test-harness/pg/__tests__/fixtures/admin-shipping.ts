// БД і сід харнес-тестів адмінки доставки (Е6а, Task 4): канон → app_runtime →
// afterAll із closeDbPool() ПЕРШИМ. Канон доставки не везе — сід свій у кожному тесті.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { resolveHarness } from '../../up.mjs';
import * as H from '../../apply.mjs';

const MIGRATIONS = join(import.meta.dirname, '../../../../migrations');

/** Реєструє хуки БД у describe, що кличе; `url()` — привілейоване підключення. */
export function useShippingAdminDb(prefix: string): { url: () => string } {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = H.randomDbName(prefix);
  let dbUrl = '';
  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, dbName);
    dbUrl = H.withDbName(harness.url, dbName);
    await H.applySqlFiles(
      dbUrl,
      readdirSync(MIGRATIONS)
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => join(MIGRATIONS, n)),
    );
    process.env.DATABASE_URL = H.withUser(dbUrl, 'app_runtime');
  }, 120_000);
  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await H.dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });
  return { url: () => dbUrl };
}

let seq = 0;
const next = () => ++seq;

export const rows = (url: string, sql: string, p: unknown[] = []) =>
  H.queryRows(url, sql, p) as Promise<Record<string, unknown>[]>;

/** Матчер доменної відмови для `rejects.toMatchObject` (409, К3-13). */
export const conflict = (kind: string, constraint?: string) => ({
  name: 'AdminConflictError',
  kind,
  ...(constraint ? { constraint } : {}),
});

const insertId = async (url: string, sql: string, p: unknown[]) => {
  const id = crypto.randomUUID();
  await rows(url, sql, [id, ...p]);
  return id;
};

/** Спосіб доставки привілейованим підключенням (повз guard — це сід). */
export const seedMethod = (url: string, provider: string) =>
  insertId(
    url,
    `insert into public.shipping_methods (id, code, name, provider)
     values ($1, $2, 'Спосіб Е6а', $3)`,
    [`e6a-m-${next()}`, provider],
  );

export const seedPoint = (url: string, methodId: string, isSystem = false) =>
  insertId(
    url,
    `insert into public.pickup_points (id, method_id, name, address, city, is_system)
     values ($1, $2, $3, 'вул. Е6а, 1', 'Київ', $4)`,
    [methodId, `Точка ${next()}`, isSystem],
  );

export const seedProduct = (url: string) =>
  insertId(
    url,
    `insert into public.products (id, slug, name) values ($1, $2, 'Товар Е6а')`,
    [`e6a-product-${next()}`],
  );

export const seedStock = (url: string, pointId: string, qty: number) =>
  seedProduct(url).then((productId) =>
    insertId(
      url,
      `insert into public.stock_by_pickup_point (id, pickup_point_id, product_id, quantity)
       values ($1, $2, $3, $4)`,
      [pointId, productId, qty],
    ),
  );

export const seedZone = (url: string, isActive = true) =>
  insertId(
    url,
    `insert into public.shipping_zones (id, name, is_active) values ($1, $2, $3)`,
    [`Зона ${next()}`, isActive],
  );

export const seedRate = (url: string, methodId: string, zoneId: string) =>
  insertId(
    url,
    `insert into public.shipping_rates (id, method_id, zone_id, name) values ($1, $2, $3, 'Тариф')`,
    [methodId, zoneId],
  );

/** Позиція незавершеного замовлення, що списала `reserved` з точки. */
export const seedReservedItem = async (
  url: string,
  pointId: string,
  reserved: number,
) => {
  const orderId = await insertId(
    url,
    `insert into public.orders (id, order_number, subtotal, total, first_name, last_name, email, phone, payment_method)
     values ($1, $2, 1, 1, 'Т', 'П', 't@example.test', '+380000000000', 'cash')`,
    [`E6A-${next()}`],
  );
  return insertId(
    url,
    `insert into public.order_items (id, order_id, name, price, quantity, total, stock_point_id, stock_reserved)
     values ($1, $2, 'Товар', 1, $4, 1, $3, $4)`,
    [orderId, pointId, reserved],
  );
};

/** Стан доставки способу: точки, їхні рядки залишку й тарифи (Review Focus 1). */
export const snapshotShipping = async (url: string, methodId: string) => ({
  method: await rows(
    url,
    `select * from public.shipping_methods where id = $1`,
    [methodId],
  ),
  points: await rows(
    url,
    `select * from public.pickup_points where method_id = $1 order by id`,
    [methodId],
  ),
  stock: await rows(
    url,
    `select s.* from public.stock_by_pickup_point s
       join public.pickup_points p on p.id = s.pickup_point_id
      where p.method_id = $1 order by s.id`,
    [methodId],
  ),
  rates: await rows(
    url,
    `select * from public.shipping_rates where method_id = $1 order by id`,
    [methodId],
  ),
});
