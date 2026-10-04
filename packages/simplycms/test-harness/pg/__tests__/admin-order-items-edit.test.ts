// К3-Е5б Task 3: додавання позиції до оформленого замовлення (Е5б-1, Е5б-7′,
// Е5б-8) проти живої БД. Ціна нової позиції — рушієм чекауту для покупця
// замовлення, контекст знижок «від суми» — склад ПІСЛЯ додавання; залишок —
// дельтою по позиції; суми — перерахунком із доставкою. 🔴 Увесь файл — під
// колонковим SELECT `app_admin` на `orders` без `access_token` (Е5-7).
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

describe('admin: додавання позиції замовлення (К3-Е5б, Task 3)', () => {
  const f = useOrderItemsEditDb('simplycms_e5b_add');
  const { ids } = f;

  it('add: ціна для покупця (тип ціни категорії, знижка), stock списано, subtotal/shipping/total перераховано', async () => {
    const o = await f.place([{ productId: ids.station, quantity: 1 }], {
      method: 'fixed',
      userId: ids.wholesale,
    });
    expect(await f.sums(o)).toEqual({
      subtotal: '60000.00',
      shippingCost: '70.10',
      total: '60070.10',
    });
    const before = await f.stock(ids.panel);

    const { order, upserted, removedIds } = await f.add(o, ids.panel, 2);

    // Гуртова ціна 4000 і гуртова знижка −10 %, а не роздрібні 4800/−10 %.
    expect(upserted).toHaveLength(1);
    expect(upserted[0]).toMatchObject({
      orderId: o,
      productId: ids.panel,
      price: '3600.00',
      basePrice: '4000.00',
      quantity: 2,
      total: '7200.00',
      stockPointId: ids.point,
      stockReserved: 2,
    });
    expect(upserted[0]!.discountData).not.toBeNull();
    expect(removedIds).toEqual([]);
    expect(await f.stock(ids.panel)).toBe(before - 2);
    expect(order).toMatchObject({
      subtotal: '67200.00',
      shippingCost: '70.10',
      total: '67270.10',
    });
    expect(await f.sums(o)).toEqual({
      subtotal: '67200.00',
      shippingCost: '70.10',
      total: '67270.10',
    });
  });

  it('add гостьовому замовленню: дефолтний тип ціни', async () => {
    // Знижка «від 50000 — 5 %» на акумулятор бачить ВЕСЬ склад (Е5б-1):
    // 21000 сам по собі під поріг, разом зі станцією 68000 — над ним.
    const o = await f.place([{ productId: ids.station, quantity: 1 }]);
    const { order, upserted } = await f.add(o, ids.battery, 1);
    expect(upserted[0]).toMatchObject({
      price: '19950.00',
      basePrice: '21000.00',
      total: '19950.00',
      stockReserved: 0,
    });
    expect(order).toMatchObject({
      subtotal: '87950.00',
      shippingCost: '0.00',
      total: '87950.00',
    });
  });

  it('add понад залишок → 409 order_insufficient_stock; позицій не додано, залишок і суми незмінні', async () => {
    const o = await f.place([{ productId: ids.battery, quantity: 1 }]);
    await f.setStock(ids.panel, 3);
    try {
      const before = await f.snapshot(o);
      await expect(f.add(o, ids.panel, 5)).rejects.toMatchObject(
        conflict('order_insufficient_stock'),
      );
      expect(await f.snapshot(o)).toEqual(before);
    } finally {
      await f.setStock(ids.panel, 1000);
    }
  });

  it('add недоступного товару → 409 order_item_not_purchasable, нічого не змінено', async () => {
    const o = await f.place([{ productId: ids.battery, quantity: 1 }]);
    const before = await f.snapshot(o);
    await expect(f.add(o, ids.panel550, 1)).rejects.toMatchObject(
      conflict('order_item_not_purchasable'),
    );
    expect(await f.snapshot(o)).toEqual(before);
  });

  it('add того самого товару — НОВИЙ рядок зі своєю ціною (знімки не змішуються)', async () => {
    const o = await f.place([{ productId: ids.battery, quantity: 1 }]);
    const { upserted } = await f.add(o, ids.battery, 2);
    expect(upserted[0]!.quantity).toBe(2);
    expect((await f.items(o)).map((i) => i.quantity)).toEqual([1, 2]);
  });
});
