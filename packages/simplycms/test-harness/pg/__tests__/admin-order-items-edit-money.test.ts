// К3-Е5б Task 3: гроші при редагуванні позицій (Е5б-13) — цілі центи замість
// float і межі колонок (`numeric(12,2)` позиції й сум, `numeric(10,2)`
// доставки) ДО запису: 409 `order_amount_out_of_range`, а не помилка БД.
// Знімок ціни позиції в межових кейсах задається SQL-ом — так само, як його
// заморозило б оформлення за старим прайсом (Е5б-1: кількість множить
// ЗБЕРЕЖЕНУ ціну).
import { describe, expect, it, vi } from 'vitest';
import { conflict, useOrderItemsEditDb } from './fixtures/order-items-edit';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

describe('admin: суми замовлення при редагуванні позицій (К3-Е5б, Task 3)', () => {
  const f = useOrderItemsEditDb('simplycms_e5b_money');
  const { ids } = f;

  /** Знімок ціни позиції — як після оформлення за іншим прайсом. */
  const freezePrice = (orderItemId: string, price: string) =>
    f.rows(
      `update public.order_items set price = $2::numeric, total = $2::numeric where id = $1`,
      [orderItemId, price],
    );

  it('суми з копійками: 3 × 1234.55 + доставка 70.10 → subtotal 3703.65, total 3773.75 рядками numeric', async () => {
    const o = await f.place([{ productId: ids.inverter, quantity: 1 }], {
      method: 'fixed',
    });
    const item = await f.itemOf(o, ids.inverter);
    const { order, upserted } = await f.setQty(o, item, 3);
    expect(upserted[0]).toMatchObject({
      id: item,
      price: '1234.55',
      quantity: 3,
      total: '3703.65',
    });
    expect(order).toMatchObject({
      subtotal: '3703.65',
      shippingCost: '70.10',
      total: '3773.75',
    });
    expect(await f.sums(o)).toEqual({
      subtotal: '3703.65',
      shippingCost: '70.10',
      total: '3773.75',
    });
  });

  it('та сама кількість → no-op: суми й доставка не перераховуються', async () => {
    const o = await f.place([{ productId: ids.inverter, quantity: 2 }], {
      method: 'fixed',
    });
    const item = await f.itemOf(o, ids.inverter);
    // Доставку «зіпсовано» руками: перерахунок її б виправив, no-op — ні.
    await f.rows(
      `update public.orders set shipping_cost = 1, total = subtotal + 1 where id = $1`,
      [o],
    );
    const before = await f.snapshot(o);
    const { order, upserted } = await f.setQty(o, item, 2);
    expect(order.shippingCost).toBe('1.00');
    expect(upserted[0]).toMatchObject({ id: item, quantity: 2 });
    expect(await f.snapshot(o)).toEqual(before);
  });

  it('кількість, що виводить total за межу numeric(12,2) → 409 order_amount_out_of_range, нічого не змінено', async () => {
    const o = await f.place([{ productId: ids.inverter, quantity: 1 }], {
      method: 'fixed',
    });
    const item = await f.itemOf(o, ids.inverter);
    await freezePrice(item, '2000000.00');
    const before = await f.snapshot(o);
    // 2 000 000.00 × 9999 = 19 998 000 000.00 > 9 999 999 999.99.
    await expect(f.setQty(o, item, 9999)).rejects.toMatchObject(
      conflict('order_amount_out_of_range'),
    );
    expect(await f.snapshot(o)).toEqual(before);
  });

  it('тариф (відсоток від суми), що виводить shipping_cost за межу numeric(10,2) при subtotal у межах → 409 order_amount_out_of_range, а не помилка БД', async () => {
    const o = await f.place([{ productId: ids.inverter, quantity: 1 }], {
      method: 'percent',
    });
    const item = await f.itemOf(o, ids.inverter);
    await freezePrice(item, '50000000.00');
    const before = await f.snapshot(o);
    // subtotal 150 000 000.00 вміщається в numeric(12,2), доставка 100 % —
    // ні в numeric(10,2) (≤ 99 999 999.99); total 300 000 000.00 — вміщається.
    await expect(f.setQty(o, item, 3)).rejects.toMatchObject(
      conflict('order_amount_out_of_range'),
    );
    expect(await f.snapshot(o)).toEqual(before);
  });
});
