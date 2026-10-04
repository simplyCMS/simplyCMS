// К3-Е5б, Task 2 (Е5б-7′): дельта залишку по ОДНІЙ позиції оформленого
// замовлення. Єдина правда — лічильник `order_items.stock_reserved`, а не
// наявність `stock_point_id`. Кожен кейс асертить і лічильник, і ТОЧНИЙ
// залишок після зміни кількості та після скасування.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import {
  adjustOrderItemStock,
  InsufficientStockError,
  releaseOrderItemStock,
  releaseOrderStock,
  reserveNewOrderItemStock,
} from 'simplycms/inventory';
import { orderItems } from 'simplycms/schema';
import { useOrderItemStockDb } from './fixtures/order-item-stock';

describe('дельта залишку по позиції замовлення (Е5б-7′)', () => {
  const f = useOrderItemStockDb('simplycms_order_item_stock');
  const { ids } = f;

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
  const releaseItem = (orderId: string, itemId: string) =>
    f.admin(orderId, (db) => releaseOrderItemStock(db, itemId));
  const releaseOrder = (orderId: string) =>
    f.admin(orderId, (db) => releaseOrderStock(db, orderId));
  const addNew = async (
    orderId: string,
    productId: string,
    quantity: number,
  ) => {
    const orderItemId = await f.insertItem(orderId, productId, quantity);
    const res = await f.admin(orderId, (db) =>
      reserveNewOrderItemStock(db, {
        orderItemId,
        orderId,
        productId,
        modificationId: null,
        quantity,
      }),
    );
    return { orderItemId, res };
  };

  it('нова позиція при увімкненому тумблері: точка й stock_reserved записані, залишок списано', async () => {
    await f.setToggle(true);
    await f.setStock(ids.panel, 10);
    await f.setStock(ids.panel2, 10);
    const orderId = await f.order([{ productId: ids.panel2, quantity: 1 }]);
    const { orderItemId, res } = await addNew(orderId, ids.panel, 3);
    expect(res).toEqual({ stockPointId: ids.point, reserved: 3 });
    expect(await f.item(orderItemId)).toEqual({
      quantity: 3,
      stockPointId: ids.point,
      stockReserved: 3,
    });
    expect(await f.stock(ids.panel)).toBe(7);
  });

  it('нова позиція при вимкненому: необлікова, залишок не чіпали', async () => {
    await f.setToggle(false);
    await f.setStock(ids.panel, 10);
    const orderId = await f.order([{ productId: ids.panel2, quantity: 1 }]);
    const { orderItemId, res } = await addNew(orderId, ids.panel, 3);
    expect(res).toEqual({ stockPointId: null, reserved: 0 });
    expect(await f.item(orderItemId)).toEqual({
      quantity: 3,
      stockPointId: null,
      stockReserved: 0,
    });
    expect(await f.stock(ids.panel)).toBe(10);
    await f.setToggle(true);
  });

  it('нова позиція без рядка order_items → Error, залишок не списано', async () => {
    await f.setStock(ids.panel, 10);
    const orderId = await f.order([{ productId: ids.panel2, quantity: 1 }]);
    const ghost = crypto.randomUUID();
    await expect(
      f.admin(orderId, (db) =>
        reserveNewOrderItemStock(db, {
          orderItemId: ghost,
          orderId,
          productId: ids.panel,
          modificationId: null,
          quantity: 2,
        }),
      ),
    ).rejects.toThrow(/not found/);
    expect(await f.stock(ids.panel)).toBe(10);
  });

  it('збільшення облікової: списано Δ, stock_reserved += Δ; нестача → InsufficientStockError, нічого не змінено', async () => {
    await f.setStock(ids.panel, 10);
    const orderId = await f.order([{ productId: ids.panel, quantity: 2 }]);
    const itemId = await f.itemOf(orderId, ids.panel);
    expect(await f.stock(ids.panel)).toBe(8);
    expect(await adjust(orderId, itemId, 5)).toEqual({ reserved: 5 });
    expect(await f.item(itemId)).toEqual({
      quantity: 5,
      stockPointId: ids.point,
      stockReserved: 5,
    });
    expect(await f.stock(ids.panel)).toBe(5);
    await expect(adjust(orderId, itemId, 11)).rejects.toBeInstanceOf(
      InsufficientStockError,
    );
    expect(await f.item(itemId)).toEqual({
      quantity: 5,
      stockPointId: ids.point,
      stockReserved: 5,
    });
    expect(await f.stock(ids.panel)).toBe(5);
  });

  it('зменшення: повернуто |Δ|, stock_reserved -= |Δ|', async () => {
    await f.setStock(ids.panel, 10);
    const orderId = await f.order([{ productId: ids.panel, quantity: 4 }]);
    const itemId = await f.itemOf(orderId, ids.panel);
    expect(await adjust(orderId, itemId, 1)).toEqual({ reserved: 1 });
    expect(await f.item(itemId)).toEqual({
      quantity: 1,
      stockPointId: ids.point,
      stockReserved: 1,
    });
    expect(await f.stock(ids.panel)).toBe(9);
    expect(await releaseOrder(orderId)).toEqual({ released: 1 });
    expect(await f.stock(ids.panel)).toBe(10);
  });

  it('необлікова позиція (stock_point_id NULL) лишається необліковою після зміни кількості, навіть якщо тумблер увімкнули', async () => {
    await f.setToggle(false);
    await f.setStock(ids.panel, 10);
    const orderId = await f.order([{ productId: ids.panel, quantity: 2 }]);
    const itemId = await f.itemOf(orderId, ids.panel);
    await f.setToggle(true);
    expect(await adjust(orderId, itemId, 6)).toEqual({ reserved: 0 });
    expect(await f.item(itemId)).toEqual({
      quantity: 6,
      stockPointId: null,
      stockReserved: 0,
    });
    expect(await f.stock(ids.panel)).toBe(10);
    expect(await adjust(orderId, itemId, 1)).toEqual({ reserved: 0 });
    expect(await f.stock(ids.panel)).toBe(10);
  });

  it('🔴 точка задана, stock_reserved = 0 (рядка залишку не було) → рядок залишку завели → ЗМЕНШЕННЯ кількості НЕ повертає нічого; скасування теж (Е5б-7′)', async () => {
    await f.untrack(ids.inverter);
    const orderId = await f.order([{ productId: ids.inverter, quantity: 3 }]);
    const itemId = await f.itemOf(orderId, ids.inverter);
    expect(await f.item(itemId)).toEqual({
      quantity: 3,
      stockPointId: ids.point,
      stockReserved: 0,
    });
    await f.setStock(ids.inverter, 10);
    expect(await adjust(orderId, itemId, 1)).toEqual({ reserved: 0 });
    expect(await f.item(itemId)).toEqual({
      quantity: 1,
      stockPointId: ids.point,
      stockReserved: 0,
    });
    expect(await f.stock(ids.inverter)).toBe(10);
    expect(await releaseItem(orderId, itemId)).toEqual({ released: 0 });
    expect(await releaseOrder(orderId)).toEqual({ released: 0 });
    expect(await f.stock(ids.inverter)).toBe(10);
  });

  it('точка задана, stock_reserved = 0 → рядок залишку завели → ЗБІЛЬШЕННЯ списує Δ, stock_reserved = Δ; скасування повертає рівно Δ', async () => {
    await f.untrack(ids.inverter);
    const orderId = await f.order([{ productId: ids.inverter, quantity: 2 }]);
    const itemId = await f.itemOf(orderId, ids.inverter);
    await f.setStock(ids.inverter, 10);
    expect(await adjust(orderId, itemId, 5)).toEqual({ reserved: 3 });
    expect(await f.item(itemId)).toEqual({
      quantity: 5,
      stockPointId: ids.point,
      stockReserved: 3,
    });
    expect(await f.stock(ids.inverter)).toBe(7);
    expect(await releaseOrder(orderId)).toEqual({ released: 1 });
    expect(await f.item(itemId)).toEqual({
      quantity: 5,
      stockPointId: ids.point,
      stockReserved: 0,
    });
    expect(await f.stock(ids.inverter)).toBe(10);
  });

  it('releaseOrderItemStock: повертає stock_reserved і обнуляє; повторний виклик — 0', async () => {
    await f.setStock(ids.panel, 10);
    const orderId = await f.order([{ productId: ids.panel, quantity: 4 }]);
    const itemId = await f.itemOf(orderId, ids.panel);
    expect(await releaseItem(orderId, itemId)).toEqual({ released: 4 });
    expect(await f.item(itemId)).toEqual({
      quantity: 4,
      stockPointId: ids.point,
      stockReserved: 0,
    });
    expect(await f.stock(ids.panel)).toBe(10);
    expect(await releaseItem(orderId, itemId)).toEqual({ released: 0 });
    expect(await f.stock(ids.panel)).toBe(10);
  });

  it('після adjust + release позиції releaseOrderStock усього замовлення повертає рівно залишок інших позицій', async () => {
    await f.setStock(ids.panel, 10);
    await f.setStock(ids.panel2, 10);
    const orderId = await f.order([
      { productId: ids.panel, quantity: 2 },
      { productId: ids.panel2, quantity: 3 },
    ]);
    const panelItem = await f.itemOf(orderId, ids.panel);
    expect(await adjust(orderId, panelItem, 4)).toEqual({ reserved: 4 });
    expect(await f.stock(ids.panel)).toBe(6);
    expect(await releaseItem(orderId, panelItem)).toEqual({ released: 4 });
    expect(await f.stock(ids.panel)).toBe(10);
    expect(await f.stock(ids.panel2)).toBe(7);
    expect(await releaseOrder(orderId)).toEqual({ released: 1 });
    expect(await f.stock(ids.panel)).toBe(10);
    expect(await f.stock(ids.panel2)).toBe(10);
  });

  it('on_order: збільшення йде в мінус без InsufficientStockError', async () => {
    await f.setStock(ids.battery, 1, 'on_order');
    const orderId = await f.order([{ productId: ids.battery, quantity: 1 }]);
    const itemId = await f.itemOf(orderId, ids.battery);
    expect(await f.stock(ids.battery)).toBe(0);
    expect(await adjust(orderId, itemId, 4)).toEqual({ reserved: 4 });
    expect(await f.item(itemId)).toEqual({
      quantity: 4,
      stockPointId: ids.point,
      stockReserved: 4,
    });
    expect(await f.stock(ids.battery)).toBe(-3);
    expect(await releaseOrder(orderId)).toEqual({ released: 1 });
    expect(await f.stock(ids.battery)).toBe(1);
  });
});
