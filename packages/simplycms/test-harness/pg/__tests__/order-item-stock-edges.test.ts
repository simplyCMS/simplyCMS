// К3-Е5б Task 8 (D): межові гілки обліку по позиції — точку видалено після
// оформлення (`stock_point_id IS NULL`, `stock_reserved > 0`, Е5-11),
// рядок залишку зник (повертати нікуди) і гварди `reserveNewOrderItemStock`.
// Окремий файл: `order-item-stock.test.ts` уже понад ліміт розміру.
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adjustOrderItemStock,
  releaseOrderItemStock,
  releaseOrderStock,
  reserveNewOrderItemStock,
} from 'simplycms/inventory';
import { orderItems } from 'simplycms/schema';
import { useOrderItemStockDb } from './fixtures/order-item-stock';

describe('облік позиції: межові гілки (Е5-11, Е5б-7′)', () => {
  const f = useOrderItemStockDb('simplycms_order_item_stock_edges');
  const { ids } = f;
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(async () => {
    await f.setToggle(true);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  /** Замовлення з однією обліковою позицією `qty` одиниць панелі (залишок 10). */
  const placed = async (qty: number) => {
    await f.setStock(ids.panel, 10);
    const orderId = await f.order([{ productId: ids.panel, quantity: qty }]);
    return { orderId, itemId: await f.itemOf(orderId, ids.panel) };
  };
  /** Точку видалено після оформлення: FK SET NULL лишив лічильник. */
  const pointDeleted = (orderId: string, itemId: string) =>
    f.admin(orderId, (db) =>
      db
        .update(orderItems)
        .set({ stockPointId: null })
        .where(eq(orderItems.id, itemId)),
    );

  it('releaseOrderStock: точку видалено — лічильник 0, залишок не повернуто, released її не рахує', async () => {
    const { orderId, itemId } = await placed(3);
    await pointDeleted(orderId, itemId);
    expect(
      await f.admin(orderId, (db) => releaseOrderStock(db, orderId)),
    ).toEqual({ released: 0 });
    expect(await f.item(itemId)).toEqual({
      quantity: 3,
      stockPointId: null,
      stockReserved: 0,
    });
    expect(await f.stock(ids.panel)).toBe(7);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('🔴 releaseOrderStock: рядка залишку на точці вже немає — released не рахує позицію без фактичного повернення', async () => {
    await f.setStock(ids.panel2, 10);
    const orderId = await f.order([
      { productId: ids.panel, quantity: 2 },
      { productId: ids.panel2, quantity: 1 },
    ]);
    // Рядок обліку панелі прибрали вручну після оформлення.
    await f.untrack(ids.panel);
    expect(
      await f.admin(orderId, (db) => releaseOrderStock(db, orderId)),
    ).toEqual({ released: 1 });
    expect(await f.stock(ids.panel2)).toBe(10);
  });

  it('adjustOrderItemStock, зменшення при видаленій точці: лічильник −= r, залишок не чіпається', async () => {
    const { orderId, itemId } = await placed(3);
    await pointDeleted(orderId, itemId);
    expect(
      await f.admin(orderId, (db) => adjustOrderItemStock(db, itemId, 1)),
    ).toEqual({ reserved: 1 });
    expect((await f.item(itemId)).stockReserved).toBe(1);
    expect(await f.stock(ids.panel)).toBe(7);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('releaseOrderItemStock при видаленій точці: warn, released 0, лічильник 0', async () => {
    const { orderId, itemId } = await placed(4);
    await pointDeleted(orderId, itemId);
    expect(
      await f.admin(orderId, (db) => releaseOrderItemStock(db, itemId)),
    ).toEqual({ released: 0 });
    expect((await f.item(itemId)).stockReserved).toBe(0);
    expect(await f.stock(ids.panel)).toBe(6);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('releaseOrderItemStock: рядка залишку немає — released 0, лічильник 0', async () => {
    const { orderId, itemId } = await placed(2);
    await f.untrack(ids.panel);
    expect(
      await f.admin(orderId, (db) => releaseOrderItemStock(db, itemId)),
    ).toEqual({ released: 0 });
    expect((await f.item(itemId)).stockReserved).toBe(0);
  });

  it('reserveNewOrderItemStock: позиція вже облікова → Error, залишок не чіпали', async () => {
    const { orderId, itemId } = await placed(2);
    await expect(
      f.admin(orderId, (db) =>
        reserveNewOrderItemStock(db, { orderItemId: itemId, orderId }),
      ),
    ).rejects.toThrow(/is already accounted/);
    expect(await f.stock(ids.panel)).toBe(8);
  });

  it('reserveNewOrderItemStock: позиція чужого замовлення → Error, залишок не чіпали', async () => {
    const { orderId } = await placed(1);
    const other = await f.order([{ productId: ids.panel2, quantity: 1 }]);
    const fresh = await f.insertItem(orderId, ids.panel, 2);
    await expect(
      f.admin(other, (db) =>
        reserveNewOrderItemStock(db, { orderItemId: fresh, orderId: other }),
      ),
    ).rejects.toThrow(/belongs to another order/);
    expect(await f.item(fresh)).toEqual({
      quantity: 2,
      stockPointId: null,
      stockReserved: 0,
    });
    expect(await f.stock(ids.panel)).toBe(9);
  });
});
