// Е5, фінальне рев'ю п.1: `FOR UPDATE` у CTE `taken` (`releaseOrderStock`)
// серіалізує два повернення одного замовлення на шарі ЛІЧИЛЬНИКА — без гварда
// статусу (`lockOrderStatus` тут не викликається взагалі). Детерміновано:
// транзакція A повертає залишок і НЕ комітиться; B з тим самим orderId стоїть
// САМЕ на A (`waitForBlockedBy` за pid A); після коміту A — B бачить 0.
// Без `for update` B читає снапшот із `stock_reserved > 0`, чекає лише на
// UPDATE і повертає залишок удруге (негативний контроль — у звіті хвилі).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { releaseOrderStock } from 'simplycms/inventory';
import { withCustomerDb } from 'simplycms/storefront/loaders';
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
import { orderInput, placeOrder, waitForBlockedBy } from './fixtures/orders';

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');
const PANEL = 'sonyachna-panel-450w-mono';

describe('releaseOrderStock: FOR UPDATE серіалізує паралельні повернення', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_release_race');
  let dbUrl = '';
  const ids = { method: '', point: '', panel: '', user: '' };

  const one = async <T>(text: string, params: unknown[] = []) =>
    ((await queryRows(dbUrl, text, params)) as T[])[0]!;
  const stock = async () =>
    (
      await one<{ q: number }>(
        `select quantity as q from public.stock_by_pickup_point
          where product_id = $1 and pickup_point_id = $2`,
        [ids.panel, ids.point],
      )
    ).q;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, [
      ...readdirSync(MIGRATIONS)
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => join(MIGRATIONS, n)),
      join(MIGRATIONS, 'demo/demo-seed.sql'),
    ]);
    const id = async (text: string, p: unknown[] = []) =>
      (await one<{ id: string }>(text, p)).id;
    ids.method = await id(
      `select id from public.shipping_methods where code = 'pickup'`,
    );
    ids.point = await id(`select id from public.pickup_points where is_system`);
    ids.panel = await id(`select id from public.products where slug = $1`, [
      PANEL,
    ]);
    ids.user = await id(
      `insert into public.users (id, name, email, email_verified)
       values (gen_random_uuid(), 'Покупець', 'race@example.test', true) returning id`,
    );
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('🔴 A тримає позиції незакоміченими → B стоїть на A → після коміту A B повертає { released: 0 }; залишок повернуто рівно один раз', async () => {
    const initial = await stock();
    const orderId = await placeOrder(
      orderInput(ids.method, ids.point, [
        { productId: ids.panel, quantity: 3 },
      ]),
      ids.user,
    );
    expect(await stock()).toBe(initial - 3);

    let ready!: (pid: number) => void;
    const pidOfA = new Promise<number>((r) => (ready = r));
    let commitA!: () => void;
    const gate = new Promise<void>((r) => (commitA = r));

    // Транзакція A — той самий шлях, що й код: ескалація оператора в
    // транзакції актора; повернення виконано, коміт відкладено воротами.
    const a = withCustomerDb(ids.user, (_db, operator) =>
      operator(async (odb) => {
        const res = await releaseOrderStock(odb, orderId);
        const pid = await odb.execute(sql`select pg_backend_pid() as pid`);
        ready(Number((pid.rows[0] as { pid: number }).pid));
        await gate;
        return res;
      }),
    );
    a.catch(() => {}); // відмову побачить await нижче
    const holderPid = await pidOfA;

    const b = withCustomerDb(ids.user, (_db, operator) =>
      operator((odb) => releaseOrderStock(odb, orderId)),
    );
    b.catch(() => {});
    try {
      const waiter = await waitForBlockedBy(dbUrl, holderPid);
      expect(waiter.query).toMatch(/stock_reserved/);
    } finally {
      commitA();
    }

    expect(await a).toEqual({ released: 1 });
    expect(await b).toEqual({ released: 0 });
    expect(await stock()).toBe(initial);
    const reserved = await one<{ r: number }>(
      `select sum(stock_reserved)::int as r from public.order_items where order_id = $1`,
      [orderId],
    );
    expect(reserved.r).toBe(0);
  });
});
