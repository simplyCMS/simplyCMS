// К3-Е5б, фінальне рев'ю п.2(а,б): межі `numeric(12,2)` при ДОДАВАННІ позиції
// і в перерахунку сум (Е5б-13) — 409 `order_amount_out_of_range` ДО запису,
// а не помилка БД. Кожна позиція тут — у межах колонки; за межу виходить
// або total нової позиції, або сума замовлення (кілька позицій), або total
// через доставку. Знімки цін — SQL-ом, як у `-money` (Е5б-1).
import { describe, expect, it, vi } from 'vitest';
import { conflict, useOrderItemsEditDb } from './fixtures/order-items-edit';
import { INVERTER_PRICE } from './fixtures/order-items-edit-data';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

const OUT_OF_RANGE = conflict('order_amount_out_of_range');

describe('admin: межі сум при додаванні й перерахунку (К3-Е5б, рев’ю п.2)', () => {
  const f = useOrderItemsEditDb('simplycms_e5b_bounds');
  const { ids } = f;

  const freezePrice = (orderItemId: string, price: string) =>
    f.rows(
      `update public.order_items set price = $2::numeric, total = $2::numeric where id = $1`,
      [orderItemId, price],
    );
  /** Роздрібна ціна інвертора (без обліку залишку й без знижок) — на час кейсу. */
  const inverterPrice = (price: string) =>
    f.rows(
      `update public.product_prices set price = $2::numeric
        where modification_id is null and product_id = $1
          and price_type_id = (select id from public.price_types where code = 'retail')`,
      [ids.inverter, price],
    );

  it('add: ціна в межах, але price × кількість за межею numeric(12,2) → 409, нічого не змінено', async () => {
    const o = await f.place([{ productId: ids.battery, quantity: 1 }]);
    const before = await f.snapshot(o);
    await inverterPrice('2000000.00');
    try {
      // 2 000 000.00 × 9999 = 19 998 000 000.00 > 9 999 999 999.99.
      await expect(f.add(o, ids.inverter, 9999)).rejects.toMatchObject(
        OUT_OF_RANGE,
      );
    } finally {
      await inverterPrice(INVERTER_PRICE);
    }
    expect(await f.snapshot(o)).toEqual(before);
  });

  it('subtotal кількох позицій у межах кожна виходить за numeric(12,2) → 409, нічого не змінено', async () => {
    const o = await f.place([
      { productId: ids.panel, quantity: 1 },
      { productId: ids.battery, quantity: 1 },
    ]);
    await freezePrice(await f.itemOf(o, ids.panel), '5000000000.00');
    await freezePrice(await f.itemOf(o, ids.battery), '5000000000.00');
    const before = await f.snapshot(o);
    // 5e9 + 5e9 + 1234.55 = 10 000 001 234.55 > 9 999 999 999.99.
    await expect(f.add(o, ids.inverter, 1)).rejects.toMatchObject(OUT_OF_RANGE);
    expect(await f.snapshot(o)).toEqual(before);
  });

  it('subtotal у межах, total за межею лише через доставку → 409, нічого не змінено', async () => {
    const o = await f.place([{ productId: ids.inverter, quantity: 1 }], {
      method: 'fixed',
    });
    await freezePrice(await f.itemOf(o, ids.inverter), '9999998715.45');
    const before = await f.snapshot(o);
    // subtotal 9 999 998 715.45 + 1234.55 = 9 999 999 950.00 — вміщається;
    // + доставка 70.10 = 10 000 000 020.10 — ні.
    await expect(f.add(o, ids.inverter, 1)).rejects.toMatchObject(OUT_OF_RANGE);
    expect(await f.snapshot(o)).toEqual(before);
  });
});
