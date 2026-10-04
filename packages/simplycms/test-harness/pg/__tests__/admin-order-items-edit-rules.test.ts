// К3-Е5б Task 3: правила редагування позицій (Е5б-2, Е5б-3, Е5б-8, Е5б-9) —
// нестача залишку при зміні кількості, остання позиція, перерахунок доставки
// за тарифом, «скасоване — кінцеве» і чужа позиція. Кожна відмова — нічого
// не змінено: ні позиції, ні залишок, ні суми.
import { describe, expect, it, vi } from 'vitest';
import { changeOrderStatusOp } from 'simplycms/admin-server/impl';
import { conflict, useOrderItemsEditDb } from './fixtures/order-items-edit';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

const CANCELLED = '00000001-0000-4000-8000-000000000006';

describe('admin: правила редагування позицій (К3-Е5б, Task 3)', () => {
  const f = useOrderItemsEditDb('simplycms_e5b_rules');
  const { ids } = f;

  it('update понад залишок → 409 order_insufficient_stock; позиція, залишок і суми незмінні (Review Focus 1)', async () => {
    const o = await f.place([{ productId: ids.panel, quantity: 2 }]);
    const item = await f.itemOf(o, ids.panel);
    await f.setStock(ids.panel, 3);
    try {
      const before = await f.snapshot(o);
      await expect(f.setQty(o, item, 10)).rejects.toMatchObject(
        conflict('order_insufficient_stock'),
      );
      expect(await f.snapshot(o)).toEqual(before);
      expect(before.items[0]).toMatchObject({ quantity: 2, stockReserved: 2 });
    } finally {
      await f.setStock(ids.panel, 1000);
    }
  });

  it('remove останньої позиції → 409 order_last_item', async () => {
    const o = await f.place([{ productId: ids.panel, quantity: 1 }]);
    const before = await f.snapshot(o);
    await expect(
      f.remove(o, await f.itemOf(o, ids.panel)),
    ).rejects.toMatchObject(conflict('order_last_item'));
    expect(await f.snapshot(o)).toEqual(before);
  });

  it('remove опускає subtotal нижче free_from → shipping_cost зріс; нижче min_order_amount → 409 order_shipping_unavailable, нічого не змінено (Review Focus 3)', async () => {
    // Курʼєр контуру: базова 150, безкоштовно від 10000, мінімум 1000.
    const a = await f.place(
      [
        { productId: ids.panel, quantity: 1 },
        { productId: ids.battery, quantity: 1 },
      ],
      { method: 'courier' },
    );
    expect((await f.sums(a)).shippingCost).toBe('0.00');
    const before = await f.stock(ids.panel);
    const { order, removedIds, upserted } = await f.remove(
      a,
      await f.itemOf(a, ids.battery),
    );
    expect(removedIds).toHaveLength(1);
    expect(upserted).toEqual([]);
    // Панель 4800 −10 % «Роздріб» = 4320 < 10000 → базова доставка 150.
    expect(order).toMatchObject({
      subtotal: '4320.00',
      shippingCost: '150.00',
      total: '4470.00',
    });
    expect(await f.stock(ids.panel)).toBe(before);

    const b = await f.place(
      [
        { productId: ids.bifacial, quantity: 1 },
        { productId: ids.battery, quantity: 1 },
      ],
      { method: 'courier' },
    );
    const snap = await f.snapshot(b);
    await expect(
      f.remove(b, await f.itemOf(b, ids.battery)),
    ).rejects.toMatchObject(conflict('order_shipping_unavailable'));
    expect(await f.snapshot(b)).toEqual(snap);
  });

  it('будь-яка операція на скасованому → 409 order_cancelled_final', async () => {
    // Кожен виклик без гварду впав би ІНШОЮ відмовою: недоступний товар,
    // нестача залишку, остання позиція — тож гвард мусить іти ПЕРШИМ.
    const o = await f.place([{ productId: ids.panel, quantity: 1 }]);
    await changeOrderStatusOp({ data: { orderId: o, statusId: CANCELLED } });
    const item = await f.itemOf(o, ids.panel);
    const before = await f.snapshot(o);
    const final = conflict('order_cancelled_final');
    await expect(f.add(o, ids.panel550, 1)).rejects.toMatchObject(final);
    await expect(f.add(o, ids.battery, 1)).rejects.toMatchObject(final);
    await expect(f.setQty(o, item, 5000)).rejects.toMatchObject(final);
    await expect(f.remove(o, item)).rejects.toMatchObject(final);
    expect(await f.snapshot(o)).toEqual(before);
  });

  it('чужа позиція (orderItemId іншого замовлення) → помилка, нічого не змінено', async () => {
    const a = await f.place([
      { productId: ids.panel, quantity: 1 },
      { productId: ids.battery, quantity: 1 },
    ]);
    const b = await f.place([
      { productId: ids.panel, quantity: 2 },
      { productId: ids.battery, quantity: 1 },
    ]);
    const foreign = await f.itemOf(b, ids.panel);
    const [beforeA, beforeB] = [await f.snapshot(a), await f.snapshot(b)];
    await expect(f.setQty(a, foreign, 1)).rejects.toThrow(
      /не належить|не існує/,
    );
    await expect(f.remove(a, foreign)).rejects.toThrow(/не належить|не існує/);
    expect(await f.snapshot(a)).toEqual(beforeA);
    expect(await f.snapshot(b)).toEqual(beforeB);
  });
});
