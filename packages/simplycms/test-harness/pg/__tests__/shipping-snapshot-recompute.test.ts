// К3-Е6а: перерахунок сум після редагування позицій (`recomputeOrderTotals`)
// для знімка доставки. Рішення Е6а-23: разом із сумами оновлюється ЛИШЕ
// `shipping_data.pricing` — інакше примітка `carrier` зі знімка суперечила б
// `shipping_cost > 0`; назва, адреса й точка лишаються на момент оформлення.
import { describe, expect, it, vi } from 'vitest';
import { placeOrderFor } from 'simplycms/storefront/loaders';
import { useOrderItemsEditDb } from './fixtures/order-items-edit';
import {
  carrierMethod,
  courierInput,
  shippingDataOf,
} from './fixtures/shipping-snapshot';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('доставка: recomputeOrderTotals і знімок (К3-Е6а, Е6а-23)', () => {
  const f = useOrderItemsEditDb('simplycms_e6a_recompute');
  const { ids } = f;

  const place = async (method: string) => {
    const result = await placeOrderFor(courierInput(f, method), null);
    if (!result.ok) throw new Error(result.reason);
    return result.order.id;
  };

  it('(г) carrier після зміни кількості → shipping_cost 0, total = subtotal', async () => {
    const orderId = await place(await carrierMethod(f));
    const { order } = await f.setQty(
      orderId,
      await f.itemOf(orderId, ids.panel),
      3,
    );
    expect(order).toMatchObject({ shippingCost: '0.00' });
    const sums = await f.sums(orderId);
    expect(sums.shippingCost).toBe('0.00');
    expect(sums.total).toBe(sums.subtotal);
  });

  it('carrier → спосіб переведено на rates і перейменовано → зміна кількості: shipping_cost > 0, pricing знімка = rates, решта знімка незмінна', async () => {
    const method = await carrierMethod(f, 'e6a-carrier-to-rates');
    const orderId = await place(method);
    const before = await shippingDataOf(f, orderId);
    expect(before).toMatchObject({ pricing: 'carrier' });

    await f.rows(
      `update public.shipping_methods set pricing = 'rates', name = 'Інша назва' where id = $1`,
      [method],
    );
    await f.setQty(orderId, await f.itemOf(orderId, ids.panel), 2);

    const sums = await f.sums(orderId);
    expect(sums.shippingCost).toBe('999.00');
    expect(await shippingDataOf(f, orderId)).toEqual({
      ...(before as object),
      pricing: 'rates',
    });
  });
});
