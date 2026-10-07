// К3-Е6в, Task 6 (Е6в-19, Review Focus 5): автоправила після COMMIT
// замовлення. Оформлення — справжня воронка вітрини (`placeOrderFor`).
// `applyCategoryRules` обгорнуто `vi.fn` над оригіналом: кейс збою підміняє
// ЛИШЕ один виклик, решта кейсів ганяє справжню функцію.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { withActor } from 'simplycms/db';
import type { PlaceOrderInput } from 'simplycms/contracts';
import { placeOrderFor } from 'simplycms/storefront/loaders';
import * as F from './fixtures/customer-categories';
import { demoPickupInput } from './fixtures/orders';

vi.mock('simplycms/commerce', async (orig) => {
  const actual = await orig<typeof import('simplycms/commerce')>();
  return { ...actual, applyCategoryRules: vi.fn(actual.applyCategoryRules) };
});

import { applyCategoryRules, loadCustomerStats } from 'simplycms/commerce';

const CANCELLED = '00000001-0000-4000-8000-000000000006';

describe('автоправила після оформлення замовлення (Е6в-19)', () => {
  const db = F.useCustomersDb('simplycms_rules_after_order', { demo: true });
  const url = () => db.url();
  const ids = { vip: '' };
  let input: PlaceOrderInput;

  beforeAll(async () => {
    input = await demoPickupInput(url());
    ids.vip = await F.seedCategory(url());
  });
  afterEach(() => vi.restoreAllMocks());

  const order = (userId: string | null) => placeOrderFor(input, userId);
  const placed = async (userId: string | null) => {
    const result = await order(userId);
    if (!result.ok) throw new Error(`[harness] відмова: ${result.reason}`);
    return result.order.id;
  };
  /** Окреме джерело-категорія на кейс: правила одного кейсу не чіпають інших. */
  const scoped = async (conditions: unknown = F.ORDERS_GTE_2) => {
    const from = await F.seedCategory(url());
    const ruleId = await F.seedRule(url(), { from, to: ids.vip, conditions });
    return {
      from,
      ruleId,
      customer: await F.seedCustomer(url(), { categoryId: from }),
    };
  };

  it('orders_count >= 2 → VIP: перше замовлення — без змін, друге — VIP, історія з rule_id (профіль NULL = дефолтна)', async () => {
    const ruleId = await F.seedRule(url(), {
      from: F.DEFAULT_CATEGORY,
      to: ids.vip,
      conditions: F.ORDERS_GTE_2,
    });
    const customer = await F.seedCustomer(url(), { categoryId: null });
    await placed(customer);
    expect(await F.customerState(url(), customer)).toMatchObject({
      category_id: null,
    });
    await placed(customer);
    expect(await F.customerState(url(), customer)).toMatchObject({
      category_id: ids.vip,
    });
    expect(await F.historyOf(url(), customer)).toEqual([
      expect.objectContaining({
        from_category_id: F.DEFAULT_CATEGORY,
        to_category_id: ids.vip,
        rule_id: ruleId,
        changed_by: null,
      }),
    ]);
  });

  it('скасоване перше замовлення не рахується: після другого orders_count = 1, категорія незмінна', async () => {
    const { from, customer } = await scoped();
    const first = await placed(customer);
    await F.rows(
      url(),
      `update public.orders set status_id = $1 where id = $2`,
      [CANCELLED, first],
    );
    await placed(customer);
    expect(await F.customerState(url(), customer)).toMatchObject({
      category_id: from,
    });
    const stats = await withActor({ role: 'app_admin' }, (tx) =>
      loadCustomerStats(tx, customer, new Date()),
    );
    expect(stats?.ordersCount).toBe(1);
  });

  it('замовлення з status_id NULL рахується', async () => {
    const { customer } = await scoped();
    const first = await placed(customer);
    await F.rows(
      url(),
      `update public.orders set status_id = null where id = $1`,
      [first],
    );
    await placed(customer);
    expect(await F.customerState(url(), customer)).toMatchObject({
      category_id: ids.vip,
    });
  });

  it('Review Focus 5: applyCategoryRules кидає → ok: true, замовлення в БД, категорія незмінна, console.error рівно раз', async () => {
    const { from, customer } = await scoped({
      type: 'all',
      rules: [{ field: 'orders_count', operator: '>=', value: '1' }],
    });
    vi.mocked(applyCategoryRules).mockRejectedValueOnce(
      new Error('обрив зʼєднання'),
    );
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await order(customer);
    expect(result.ok).toBe(true);
    const orderId = result.ok ? result.order.id : '';
    expect(
      await F.rows(url(), `select id from public.orders where id = $1`, [
        orderId,
      ]),
    ).toHaveLength(1);
    expect(await F.customerState(url(), customer)).toMatchObject({
      category_id: from,
    });
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it('зламаний jsonb умов (SQL в обхід Zod) → правило не спрацьовує, замовлення оформлене, без винятку', async () => {
    // Без `type` колишній рушій рахував би AND і спрацював; рядок замість
    // обʼєкта колишній рушій валив би TypeError.
    const { from, customer } = await scoped({
      rules: [{ field: 'orders_count', operator: '>=', value: '0' }],
    });
    await F.seedRule(url(), { from, to: ids.vip, conditions: 'зламано' });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    await placed(customer);
    expect(await F.customerState(url(), customer)).toMatchObject({
      category_id: from,
    });
    expect(errors).not.toHaveBeenCalled();
  });

  it('гість → правила не викликаються', async () => {
    vi.mocked(applyCategoryRules).mockClear();
    await placed(null);
    expect(applyCategoryRules).not.toHaveBeenCalled();
  });
});
