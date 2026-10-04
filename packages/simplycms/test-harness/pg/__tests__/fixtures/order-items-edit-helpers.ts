// Хелпери харнес-тестів редагування позицій (К3-Е5б Task 3): оформлення
// воронкою вітрини, стан замовлення прямим SQL і виклики іменованих операцій
// адмінки. БД і id дає `./order-items-edit` (`useOrderItemsEditDb`).
import {
  addOrderItemOp,
  removeOrderItemOp,
  updateOrderItemQuantityOp,
} from 'simplycms/admin-server/impl';
import { orderInput, placeOrder } from './orders';
import type { EditIds, METHODS } from './order-items-edit-data';

interface EditCtx {
  ids: EditIds;
  rows: <T>(text: string, p?: unknown[]) => Promise<T[]>;
  one: <T>(text: string, p?: unknown[]) => Promise<T>;
  id: (text: string, p: unknown[]) => Promise<string>;
}

export function editHelpers({ ids, rows, one, id }: EditCtx) {
  /** Залишок панелі на системній точці; статус — «в наявності». */
  const setStock = async (productId: string, qty: number) => {
    await rows(
      `update public.stock_by_pickup_point set quantity = $3
        where product_id = $1 and pickup_point_id = $2`,
      [productId, ids.point, qty],
    );
    await rows(
      `update public.products set stock_status = 'in_stock' where id = $1`,
      [productId],
    );
  };
  const stock = async (productId: string) =>
    (
      await one<{ q: number }>(
        `select quantity as q from public.stock_by_pickup_point
          where product_id = $1 and pickup_point_id = $2`,
        [productId, ids.point],
      )
    ).q;
  /** Оформлення воронкою вітрини: pickup — на системну точку, решта — курʼєром у Київ. */
  const place = (
    items: { productId: string; quantity: number }[],
    opts: { method?: keyof typeof METHODS; userId?: string } = {},
  ) => {
    const method = opts.method ?? 'pickup';
    const pickup = orderInput(ids[method], ids.point, items);
    const base =
      method === 'pickup'
        ? pickup
        : {
            ...pickup,
            pickupPointId: null,
            deliveryCity: 'Київ',
            deliveryAddress: 'вул. Тестова, 1',
          };
    return placeOrder(base, opts.userId ?? null);
  };
  const sums = (orderId: string) =>
    one<{ subtotal: string; shippingCost: string; total: string }>(
      `select subtotal::text, shipping_cost::text as "shippingCost", total::text
         from public.orders where id = $1`,
      [orderId],
    );
  /** Стан позицій замовлення — сортовано за назвою й кількістю (детерміновано). */
  const items = (orderId: string) =>
    rows<{
      productId: string;
      price: string;
      quantity: number;
      total: string;
      stockReserved: number;
    }>(
      `select product_id as "productId", price::text, quantity, total::text, stock_reserved as "stockReserved"
         from public.order_items where order_id = $1 order by name, quantity, id`,
      [orderId],
    );
  const itemOf = async (orderId: string, productId: string) =>
    id(
      `select id from public.order_items where order_id = $1 and product_id = $2 order by created_at limit 1`,
      [orderId, productId],
    );
  /** Стан, який операція з відмовою не сміє змінити. */
  const snapshot = async (orderId: string, productId = ids.panel) => ({
    sums: await sums(orderId),
    items: await items(orderId),
    stock: await stock(productId),
  });

  const add = (
    orderId: string,
    productId: string,
    quantity: number,
    modificationId: string | null = null,
  ) =>
    addOrderItemOp({ data: { orderId, productId, modificationId, quantity } });
  const setQty = (orderId: string, orderItemId: string, quantity: number) =>
    updateOrderItemQuantityOp({ data: { orderId, orderItemId, quantity } });
  const remove = (orderId: string, orderItemId: string) =>
    removeOrderItemOp({ data: { orderId, orderItemId } });

  return {
    setStock,
    stock,
    place,
    sums,
    items,
    itemOf,
    snapshot,
    add,
    setQty,
    remove,
  };
}
