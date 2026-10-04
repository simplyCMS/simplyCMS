// Е5, Task 4: ресурси замовлень і `changeOrderStatusOp` проти живої БД.
// Шапка — патерн admin-catalog-ops.test.ts (createTempDatabase → канон +
// демо-сід із decrease_on_order = true → app_runtime → afterAll із
// closeDbPool() ПЕРШИМ). Замовлення оформлюються `placeOrderFor` — тим самим
// шляхом, що й вітрина. 🔴 Увесь файл іде під КОЛОНКОВИМ SELECT `app_admin`
// на `orders` без `access_token` (SQL-доказ `omit`, Е5-7).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { ORDER_STATUS_CODE } from 'simplycms/contracts/order-status-codes';
import { cancelOwnOrder, withCustomerDb } from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';
import { holdOrderRowLock } from './fixtures/advisory-lock';
import {
  orderInput,
  placeOrder,
  restrictOrdersSelectForAdmin,
  rowLocksOnStock,
  waitForBlockedBy,
} from './fixtures/orders';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { requireGrant, resolveGrant, AuthzError } from 'simplycms/auth';
import { changeOrderStatusOp, ordersOps } from 'simplycms/admin-server/impl';

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');
const PANEL = 'sonyachna-panel-450w-mono';
const UNTRACKED = 'invertor-gibrydnyi-8kw';
const CONFIRMED = '00000001-0000-4000-8000-000000000002';
const CANCELLED = '00000001-0000-4000-8000-000000000006';
const CONFLICT = {
  name: 'AdminConflictError',
  kind: 'state',
  constraint: 'order_cancelled_final',
};

describe('admin: замовлення (Е5, Task 4)', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_admin_orders');
  let dbUrl = '';
  const ids = { method: '', point: '', panel: '', untracked: '', user: '' };

  const one = async <T>(sql: string, params: unknown[] = []) =>
    ((await queryRows(dbUrl, sql, params)) as T[])[0]!;
  const stock = async () =>
    (
      await one<{ q: number }>(
        `select quantity as q from public.stock_by_pickup_point
          where product_id = $1 and pickup_point_id = $2`,
        [ids.panel, ids.point],
      )
    ).q;
  const orderState = (id: string) =>
    one<{ code: string; reserved: number }>(
      `select s.code, (select sum(stock_reserved)::int from public.order_items
          where order_id = o.id) as reserved
         from public.orders o join public.order_statuses s on s.id = o.status_id
        where o.id = $1`,
      [id],
    );
  const place = (quantity: number, productId = ids.panel, userId?: string) =>
    placeOrder(
      orderInput(ids.method, ids.point, [{ productId, quantity }]),
      userId ?? null,
    );
  const change = (orderId: string, statusId: string) =>
    changeOrderStatusOp({ data: { orderId, statusId } });

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    const canon = readdirSync(MIGRATIONS)
      .filter((n) => n.endsWith('.sql'))
      .sort()
      .map((n) => join(MIGRATIONS, n));
    await applySqlFiles(dbUrl, [
      ...canon,
      join(MIGRATIONS, 'demo/demo-seed.sql'),
    ]);
    const id = async (sql: string, p: unknown[] = []) =>
      (await one<{ id: string }>(sql, p)).id;
    ids.method = await id(
      `select id from public.shipping_methods where code = 'pickup'`,
    );
    ids.point = await id(
      `select id from public.pickup_points where name = 'Склад у Києві'`,
    );
    ids.panel = await id(`select id from public.products where slug = $1`, [
      PANEL,
    ]);
    ids.untracked = await id(`select id from public.products where slug = $1`, [
      UNTRACKED,
    ]);
    ids.user = await id(
      `insert into public.users (id, name, email, email_verified)
       values (gen_random_uuid(), 'Покупець', 'e5-buyer@example.test', true) returning id`,
    );
    // Запас, щоб жоден кейс не впирався в нестачу сідових 5 штук.
    await queryRows(
      dbUrl,
      `update public.stock_by_pickup_point set quantity = 100
        where product_id = $1 and pickup_point_id = $2`,
      [ids.panel, ids.point],
    );
    await restrictOrdersSelectForAdmin(dbUrl);
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('listOrders: рядки без accessToken, порядок createdAt desc, id тай-брейкер', async () => {
    const a = await place(1);
    const b = await place(1);
    const c = await place(1);
    // Однакова мітка на двох (сід/імпорт) — порядок тримає тай-брейкер id.
    await queryRows(
      dbUrl,
      `update public.orders set created_at = '2030-01-01T00:00:00Z' where id in ($1, $2)`,
      [a, b],
    );
    await queryRows(
      dbUrl,
      `update public.orders set created_at = '2029-01-01T00:00:00Z' where id = $1`,
      [c],
    );
    const rows = await ordersOps.list({ data: {} });
    expect(rows.length).toBeLessThanOrEqual(100);
    expect(rows.slice(0, 3).map((r) => r.id)).toEqual([...[a, b].sort(), c]);
    for (const row of rows) expect(row).not.toHaveProperty('accessToken');
  });

  it('changeStatus new → confirmed: статус змінено, залишок не чіпали', async () => {
    const o = await place(2);
    const before = await stock();
    const { order } = await change(o, CONFIRMED);
    expect(order.statusId).toBe(CONFIRMED);
    expect(order).not.toHaveProperty('accessToken');
    expect(await stock()).toBe(before);
    expect(await orderState(o)).toEqual({ code: 'confirmed', reserved: 2 });
  });

  it('changeStatus → cancelled: залишок повернуто по позиціях, stock_reserved = 0', async () => {
    const initial = await stock();
    const o = await place(3);
    expect(await stock()).toBe(initial - 3);
    await change(o, CANCELLED);
    expect(await stock()).toBe(initial);
    expect(await orderState(o)).toEqual({
      code: ORDER_STATUS_CODE.cancelled,
      reserved: 0,
    });
  });

  it('cancelled → будь-який: AdminConflictError state, статус і залишок без змін (Review Focus 3)', async () => {
    const o = await place(1);
    await change(o, CANCELLED);
    const after = await stock();
    await expect(change(o, CONFIRMED)).rejects.toMatchObject(CONFLICT);
    expect(await stock()).toBe(after);
    expect((await orderState(o)).code).toBe('cancelled');
  });

  it('повторне → cancelled на скасованому: та сама відмова, залишок повернуто рівно один раз', async () => {
    const initial = await stock();
    const o = await place(2);
    await change(o, CANCELLED);
    await expect(change(o, CANCELLED)).rejects.toMatchObject(CONFLICT);
    expect(await stock()).toBe(initial);
  });

  it('магазин без списання (stock_reserved = 0 у всіх позиціях): скасування не чіпає залишки', async () => {
    const toggle = (v: boolean) =>
      queryRows(
        dbUrl,
        `update public.system_settings set value = jsonb_set(value, '{decrease_on_order}', $1::jsonb)
          where key = 'stock_management'`,
        [JSON.stringify(v)],
      );
    await toggle(false);
    try {
      const initial = await stock();
      const o = await place(2);
      expect(await orderState(o)).toEqual({ code: 'new', reserved: 0 });
      await change(o, CANCELLED);
      expect(await stock()).toBe(initial);
    } finally {
      await toggle(true);
    }
  });

  it('не-адмін → AuthzError, нічого не змінено', async () => {
    const o = await place(1);
    const before = await stock();
    vi.mocked(requireGrant).mockImplementationOnce(async (operation) => {
      const subject = { userId: ids.user, roles: ['user'] as const };
      const scope = resolveGrant(subject, operation);
      if (!scope) throw new AuthzError(operation);
      return { subject, scope };
    });
    await expect(change(o, CANCELLED)).rejects.toThrow(AuthzError);
    expect(await stock()).toBe(before);
    expect(await orderState(o)).toEqual({ code: 'new', reserved: 1 });
  });

  it('(а) поки рядок замовлення зайнятий зовнішнім FOR UPDATE — адмінська операція стоїть САМЕ на локу замовлення і ще не чіпала позицій і залишку', async () => {
    const initial = await stock();
    const o = await place(2);
    const holder = await holdOrderRowLock(dbUrl, o);
    try {
      const op = change(o, CANCELLED);
      op.catch(() => {}); // відмову побачить await нижче
      const waiter = await waitForBlockedBy(dbUrl, holder.pid);
      expect(waiter.query).toMatch(
        /^select [\s\S]* from "orders" [\s\S]* for update$/i,
      );
      expect(await rowLocksOnStock(dbUrl, waiter.pid)).toBe(0);
      await holder.release();
      await op;
      expect(await stock()).toBe(initial);
      expect(await orderState(o)).toEqual({ code: 'cancelled', reserved: 0 });
    } finally {
      await holder.cleanup();
    }
  });

  it('(в) інтеграційно: адмін і покупець (cancelOwnOrder) паралельно → рівно одна успішна, залишок = INITIAL, статус cancelled', async () => {
    const initial = await stock();
    const o = await place(2, ids.panel, ids.user);
    const [admin, buyer] = await Promise.allSettled([
      change(o, CANCELLED),
      withCustomerDb(ids.user, (db, operator) =>
        cancelOwnOrder(db, operator, o),
      ),
    ]);
    const adminOk = admin.status === 'fulfilled';
    const buyerOk = buyer.status === 'fulfilled' && buyer.value.ok;
    expect([adminOk, buyerOk].filter(Boolean)).toHaveLength(1);
    if (!adminOk) expect(admin.reason).toMatchObject(CONFLICT);
    expect(await stock()).toBe(initial);
    expect(await orderState(o)).toEqual({ code: 'cancelled', reserved: 0 });
  });
});
