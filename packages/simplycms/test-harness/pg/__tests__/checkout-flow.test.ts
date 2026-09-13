// Воронка: кошик → placeOrderFor → рядок в orders; серверна ціна й знижка;
// доменні відмови (К2-Е0, Е0-4). Ціни й доставку рахує СЕРВЕР — у вхідних
// даних їх немає. База — покупний демо-сід (Task 7): метод `pickup`, точка
// «Склад у Києві», дефолтна зона, безкоштовний тариф; вимкнений метод — із
// HIDDEN_SHIPPING_FIXTURES (лише негативна частина: активну доставку дає сід,
// повний набір додав би другий активний тариф на ту саму пару метод+зона);
// решта негативних рядків — тест-локальні.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import type { PlaceOrderInput } from 'simplycms/contracts';
import { placeOrderFor } from 'simplycms/storefront/loaders';
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
import {
  HIDDEN_METHOD_CODE,
  HIDDEN_SHIPPING_FIXTURES,
} from './fixtures/shipping';
import { percentDiscountStatements } from './fixtures/discounts';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');
const PANEL_SLUG = 'sonyachna-panel-450w-mono';
const OUT_OF_STOCK_SLUG = 'sonyachna-panel-550w-mono';
interface IdRow {
  id: string;
}

const input = (overrides: Partial<PlaceOrderInput>): PlaceOrderInput => ({
  firstName: 'Тест',
  lastName: 'Покупець',
  email: 'buyer@example.test',
  phone: '+380000000000',
  shippingMethodId: '',
  deliveryCity: null,
  deliveryAddress: null,
  pickupPointId: null,
  paymentMethod: 'cash',
  notes: null,
  hasDifferentRecipient: false,
  recipientFirstName: null,
  recipientLastName: null,
  recipientPhone: null,
  recipientEmail: null,
  recipientCity: null,
  recipientAddress: null,
  recipientNotes: null,
  saveRecipient: false,
  savedRecipientId: null,
  savedAddressId: null,
  items: [],
  ...overrides,
});

describe('placeOrderFor: воронка й доменні відмови', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_checkout');
  let dbUrl = '';
  let pickup = '';
  let hidden = '';
  let courier = '';
  let norate = '';
  let point = '';
  let panel = '';
  let outOfStock = '';

  const one = async (sql: string, params: unknown[] = []): Promise<string> =>
    ((await queryRows(dbUrl, sql, params)) as IdRow[])[0].id;
  const ordersCount = async (): Promise<number> =>
    (
      (await queryRows(
        dbUrl,
        `select count(*)::int as c from public.orders`,
      )) as { c: number }[]
    )[0].c;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, [
      ...readdirSync(MIGRATIONS_DIR)
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => join(MIGRATIONS_DIR, n)),
      join(MIGRATIONS_DIR, 'demo/demo-seed.sql'),
    ]);
    // Негативна частина фікстури поверх сіду: вимкнений метод, зона, тариф, закрита точка.
    for (const statement of HIDDEN_SHIPPING_FIXTURES)
      await queryRows(dbUrl, statement);
    // Тест-локальні негативні методи: курʼєр із тарифом на дефолтній зоні
    // (точка чужого методу) і активний метод без жодного тарифу.
    await queryRows(
      dbUrl,
      `insert into public.shipping_methods (id, code, name, is_active)
      values (gen_random_uuid(), 'courier', 'Курʼєр', true), (gen_random_uuid(), 'norate', 'Без тарифу', true)`,
    );
    await queryRows(
      dbUrl,
      `insert into public.shipping_rates (id, method_id, zone_id, name, calculation_type, base_cost, is_active, sort_order)
      select gen_random_uuid(), m.id, z.id, 'Тариф курʼєра', 'flat', 100, true, 0
        from public.shipping_methods m, public.shipping_zones z
       where m.code = 'courier' and z.is_default = true`,
    );
    pickup = await one(
      `select id from public.shipping_methods where code = 'pickup'`,
    );
    hidden = await one(
      `select id from public.shipping_methods where code = $1`,
      [HIDDEN_METHOD_CODE],
    );
    courier = await one(
      `select id from public.shipping_methods where code = 'courier'`,
    );
    norate = await one(
      `select id from public.shipping_methods where code = 'norate'`,
    );
    point = await one(
      `select id from public.pickup_points where name = 'Склад у Києві'`,
    );
    panel = await one(`select id from public.products where slug = $1`, [
      PANEL_SLUG,
    ]);
    outOfStock = await one(`select id from public.products where slug = $1`, [
      OUT_OF_STOCK_SLUG,
    ]);
    await queryRows(
      dbUrl,
      `update public.products set stock_status = 'out_of_stock' where id = $1`,
      [outOfStock],
    );
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    await dropTempDatabase(harness.url, dbName);
    await harness.teardown();
  });

  it('гість: замовлення з серверною ціною позиції та доставкою', async () => {
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: point,
        items: [{ productId: panel, modificationId: null, quantity: 2 }],
      }),
      null,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = (await queryRows(
      dbUrl,
      `select o.subtotal, o.shipping_cost, o.total, i.price, i.name
         from public.orders o join public.order_items i on i.order_id = o.id where o.id = $1`,
      [result.order.id],
    )) as {
      subtotal: string;
      shipping_cost: string;
      total: string;
      price: string;
      name: string;
    }[];
    // 4800 — ціна з product_prices демо-сіду, не з запиту (запит ціни не несе).
    expect(row.price).toBe('4800.00');
    expect(row.subtotal).toBe('9600.00');
    expect(row.shipping_cost).toBe('0.00');
    expect(row.total).toBe('9600.00');
    expect(row.name).toBe('Сонячна панель 450 Вт монокристалічна');
  });

  it('неактивний спосіб доставки — shipping_unavailable, рядка немає', async () => {
    const before = await ordersCount();
    const result = await placeOrderFor(
      input({
        shippingMethodId: hidden,
        items: [{ productId: panel, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'shipping_unavailable' });
    expect(await ordersCount()).toBe(before);
  });

  it('точка видачі чужого методу — pickup_point_invalid', async () => {
    const result = await placeOrderFor(
      input({
        shippingMethodId: courier,
        pickupPointId: point,
        items: [{ productId: panel, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'pickup_point_invalid' });
  });

  it('pickup-метод без точки видачі — pickup_point_invalid', async () => {
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: null,
        items: [{ productId: panel, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'pickup_point_invalid' });
  });

  it('активний метод без застосовного тарифу — shipping_unavailable, а не безкоштовно', async () => {
    const result = await placeOrderFor(
      input({
        shippingMethodId: norate,
        items: [{ productId: panel, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'shipping_unavailable' });
  });

  it('гість отримує знижку категорії за замовчуванням — як у getDiscountEnvironment', async () => {
    // Без дзеркала getDiscountEnvironment гість платив би 4800, а картка показує 4320.
    for (const statement of percentDiscountStatements({
      group: 'Роздрібна акція',
      name: 'Знижка на панель 450',
      percent: 10,
      categoryCode: 'retail',
      target: { type: 'product', slug: PANEL_SLUG },
    }))
      await queryRows(dbUrl, statement);
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: point,
        items: [{ productId: panel, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = (await queryRows(
      dbUrl,
      `select price, base_price from public.order_items where order_id = $1`,
      [result.order.id],
    )) as { price: string; base_price: string | null }[];
    expect(row.price).toBe('4320.00');
    expect(row.base_price).toBe('4800.00');
  });

  it('позиція out_of_stock — not_purchasable', async () => {
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: point,
        items: [{ productId: outOfStock, modificationId: null, quantity: 1 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'not_purchasable' });
  });

  it('нестача залишку в транзакції — not_purchasable без рядка в orders', async () => {
    // Сідовий залишок 450w — 5; два попередні замовлення списали 3. Запит на 10
    // проходить читання (статус in_stock), але падає у списанні → відкат.
    const before = await ordersCount();
    const result = await placeOrderFor(
      input({
        shippingMethodId: pickup,
        pickupPointId: point,
        items: [{ productId: panel, modificationId: null, quantity: 10 }],
      }),
      null,
    );
    expect(result).toEqual({ ok: false, reason: 'not_purchasable' });
    expect(await ordersCount()).toBe(before);
  });
});
