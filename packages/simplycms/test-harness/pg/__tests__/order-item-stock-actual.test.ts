// К3-Е5б, фінальне рев'ю п.1: `adjustOrderItemStock` рахує ФАКТИЧНО
// списане/повернуте, а не дельту кількості (Е5б-7′). Обидва кейси будують
// розрив «кількість ≠ stock_reserved», у якому Δ і фактичне число різні:
// (а) зменшення повертає лише списане, (б) збільшення без рядка залишку
// лічильник не росте. Окремий файл: сусіди вже біля/понад ліміт розміру.
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { adjustOrderItemStock } from 'simplycms/inventory';
import { orderItems } from 'simplycms/schema';
import { useOrderItemStockDb } from './fixtures/order-item-stock';

describe('дельта позиції: фактичне число, а не Δ (Е5б-7′)', () => {
  const f = useOrderItemStockDb('simplycms_order_item_stock_actual');
  const { ids } = f;
  beforeEach(() => f.setToggle(true));

  /** Зміна кількості так, як її робить операція: облік, потім запис позиції. */
  const adjust = (orderId: string, itemId: string, qty: number) =>
    f.admin(orderId, async (db) => {
      const res = await adjustOrderItemStock(db, itemId, qty);
      await db
        .update(orderItems)
        .set({ quantity: qty })
        .where(eq(orderItems.id, itemId));
      return res;
    });

  it('🔴 stock_reserved = 3 при кількості 8 → зменшення до 2 повертає рівно 3 (не |Δ| = 6), лічильник 0', async () => {
    // Оформлено 5 без рядка залишку (точка є, списано 0), рядок завели,
    // збільшили до 8 — списано лише 3: кількість 8, лічильник 3.
    await f.untrack(ids.inverter);
    const orderId = await f.order([{ productId: ids.inverter, quantity: 5 }]);
    const itemId = await f.itemOf(orderId, ids.inverter);
    await f.setStock(ids.inverter, 10);
    expect(await adjust(orderId, itemId, 8)).toEqual({ reserved: 3 });
    expect(await f.stock(ids.inverter)).toBe(7);

    expect(await adjust(orderId, itemId, 2)).toEqual({ reserved: 0 });
    expect(await f.item(itemId)).toEqual({
      quantity: 2,
      stockPointId: ids.point,
      stockReserved: 0,
    });
    // +3, а не +6: повернуто рівно те, що справді списали.
    expect(await f.stock(ids.inverter)).toBe(10);
  });

  it('🔴 точка задана, рядків залишку немає → збільшення НЕ росте лічильник (списано 0)', async () => {
    await f.untrack(ids.inverter);
    const orderId = await f.order([{ productId: ids.inverter, quantity: 2 }]);
    const itemId = await f.itemOf(orderId, ids.inverter);
    expect(await adjust(orderId, itemId, 6)).toEqual({ reserved: 0 });
    expect(await f.item(itemId)).toEqual({
      quantity: 6,
      stockPointId: ids.point,
      stockReserved: 0,
    });
  });
});
