import { orderItems, orderStatuses, orders } from 'simplycms/schema';
import type { JsonValue } from './property';

/** Статус замовлення — довідник, спільний для фільтра й картки. */
export interface OrderStatusRow {
  id: string;
  name: string;
  code: string;
  color: string | null;
}

/** Позиція замовлення. `numeric` уже переведено в числа. */
export interface OrderItemRow {
  id: string;
  name: string;
  price: number;
  base_price: number | null;
  discount_data: JsonValue | null;
  quantity: number;
  total: number;
}

/** Замовлення у списку кабінету. */
export interface OrderListRow {
  id: string;
  order_number: string;
  total: number;
  created_at: string;
  status_id: string | null;
  status: OrderStatusRow | null;
  items: OrderItemRow[];
}

/** Замовлення цілком — сторінки «деталі» й «успішне оформлення». */
export interface OrderDetailRow extends OrderListRow {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  delivery_method: string | null;
  delivery_city: string | null;
  delivery_address: string | null;
  payment_method: string;
  notes: string | null;
  subtotal: number;
  has_different_recipient: boolean;
  recipient_first_name: string | null;
  recipient_last_name: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
}

export const orderStatusColumns = {
  id: orderStatuses.id,
  name: orderStatuses.name,
  code: orderStatuses.code,
  color: orderStatuses.color,
};

export const orderItemColumns = {
  id: orderItems.id,
  order_id: orderItems.orderId,
  name: orderItems.name,
  price: orderItems.price,
  base_price: orderItems.basePrice,
  discount_data: orderItems.discountData,
  quantity: orderItems.quantity,
  total: orderItems.total,
};

export const orderColumns = {
  id: orders.id,
  order_number: orders.orderNumber,
  total: orders.total,
  subtotal: orders.subtotal,
  created_at: orders.createdAt,
  status_id: orders.statusId,
  first_name: orders.firstName,
  last_name: orders.lastName,
  email: orders.email,
  phone: orders.phone,
  delivery_method: orders.deliveryMethod,
  delivery_city: orders.deliveryCity,
  delivery_address: orders.deliveryAddress,
  payment_method: orders.paymentMethod,
  notes: orders.notes,
  has_different_recipient: orders.hasDifferentRecipient,
  recipient_first_name: orders.recipientFirstName,
  recipient_last_name: orders.recipientLastName,
  recipient_phone: orders.recipientPhone,
  recipient_email: orders.recipientEmail,
};

/** Сирий рядок позиції: `numeric` приїжджає рядком (див. `./price`). */
export interface RawOrderItem {
  id: string;
  order_id: string;
  name: string;
  price: string;
  base_price: string | null;
  discount_data: unknown;
  /* 🔴 `jsonb` приїжджає нетипізованим — каст робиться один раз у `toOrderItem`. */
  quantity: number;
  total: string;
}

export function toOrderItem(row: RawOrderItem): OrderItemRow {
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    base_price: row.base_price === null ? null : Number(row.base_price),
    discount_data: (row.discount_data ?? null) as JsonValue | null,
    quantity: row.quantity,
    total: Number(row.total),
  };
}

/** Групує позиції за замовленням — щоб список кабінету не став N+1. */
export function groupItemsByOrder(
  rows: RawOrderItem[],
): Record<string, OrderItemRow[]> {
  const byOrder: Record<string, OrderItemRow[]> = {};
  for (const row of rows) (byOrder[row.order_id] ??= []).push(toOrderItem(row));
  return byOrder;
}
