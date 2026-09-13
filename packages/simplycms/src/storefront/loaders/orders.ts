import { and, desc, eq, inArray } from 'drizzle-orm';
import { orderItems, orderStatuses, orders } from 'simplycms/schema';
import type { ActorDb } from './db';
import {
  groupItemsByOrder,
  orderColumns,
  orderItemColumns,
  orderStatusColumns,
  toOrderItem,
  type OrderDetailRow,
  type OrderListRow,
} from './entities/order';

/**
 * Замовлення покупця, опційно звужені статусом.
 *
 * 🔴 `user_id` у предикаті — з СЕРВЕРНОЇ сесії (актор транзакції). Політика
 * `orders_select_own_or_token` звужує таблицю тим самим id, тож підставити
 * чужий тут нема звідки: параметра з цим значенням у клієнта не існує.
 */
export async function loadUserOrders(
  db: ActorDb,
  userId: string,
  statusId?: string,
): Promise<OrderListRow[]> {
  const scope = statusId
    ? and(eq(orders.userId, userId), eq(orders.statusId, statusId))
    : eq(orders.userId, userId);

  const rows = await db
    .select({ order: orderColumns, status: orderStatusColumns })
    .from(orders)
    .leftJoin(orderStatuses, eq(orders.statusId, orderStatuses.id))
    .where(scope)
    .orderBy(desc(orders.createdAt));

  if (rows.length === 0) return [];

  const itemRows = await db
    .select(orderItemColumns)
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((row) => row.order.id),
      ),
    );
  const itemsByOrder = groupItemsByOrder(itemRows);

  return rows.map(({ order, status }) => ({
    id: order.id,
    order_number: order.order_number,
    total: Number(order.total),
    created_at: order.created_at,
    status_id: order.status_id,
    status: status?.id ? status : null,
    items: itemsByOrder[order.id] ?? [],
  }));
}

/**
 * Одне замовлення цілком.
 *
 * Права доводить АКТОР транзакції: `withCustomerDb` — власника,
 * `withOrderTokenDb` — гостя з токеном. Сам запит різниці не знає, тож
 * зайвого предиката тут немає навмисно: він створив би ілюзію, що саме код
 * вирішує питання доступу.
 */
export async function loadOrderDetail(
  db: ActorDb,
  orderId: string,
): Promise<OrderDetailRow | null> {
  const [row] = await db
    .select({ order: orderColumns, status: orderStatusColumns })
    .from(orders)
    .leftJoin(orderStatuses, eq(orders.statusId, orderStatuses.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) return null;

  const itemRows = await db
    .select(orderItemColumns)
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const { order, status } = row;
  return {
    ...order,
    total: Number(order.total),
    subtotal: Number(order.subtotal),
    status: status?.id ? status : null,
    items: itemRows.map(toOrderItem),
  };
}

/**
 * Перевести замовлення в статус — виконується під `app_admin`.
 *
 * 🔴 Ownership тут НЕ перевіряється й перевірятись не може: під `app_admin`
 * RLS віддає все. Право мусить бути доведене ДО виклику окремим читанням
 * під актором покупця (`server/profile-orders.ts`).
 */
export async function setOrderStatus(
  db: ActorDb,
  orderId: string,
  statusId: string,
): Promise<void> {
  await db
    .update(orders)
    .set({ statusId, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

/**
 * Блокує рядок замовлення й віддає його поточний статус.
 *
 * 🔴 Виконується під `app_admin` (ескалація): `select … for update` вимагає
 * права UPDATE, якого `app_user` на `orders` не має за побудовою
 * (`0002_grants.sql:104`).
 *
 * 🔴 Потрібне саме блокування, а не «ще одна перевірка статусу»: подвійний
 * клік по «Скасувати» дає ДВІ паралельні транзакції, і під READ COMMITTED
 * обидві прочитали б `new` — залишок повернувся б ДВІЧІ. Заблокований рядок
 * пропускає рівно одну; друга бачить уже змінений `status_id` і виходить.
 */
export async function lockOrderStatus(
  db: ActorDb,
  orderId: string,
): Promise<{ statusId: string | null } | null> {
  const [row] = await db
    .select({ statusId: orders.statusId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1)
    .for('update');

  return row ?? null;
}
