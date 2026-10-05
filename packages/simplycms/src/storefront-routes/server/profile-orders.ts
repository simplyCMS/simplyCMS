import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  cancelOwnOrder,
  loadOrderDetail,
  loadOrderStatuses,
  loadUserOrders,
  withStorefrontDb,
  type OrderCancelResult,
  type OrderDetailRow,
  type OrderListRow,
  type OrderStatusRow,
  withSessionDb,
} from 'simplycms/storefront/loaders';

/** Довідник статусів для фільтра списку — публічне читання. */
export const getOrderStatuses = createServerFn({ method: 'GET' }).handler(
  async (): Promise<OrderStatusRow[]> =>
    withStorefrontDb((db) => loadOrderStatuses(db)),
);

/** Замовлення власника сесії, опційно звужені статусом. */
export const getMyOrders = createServerFn({ method: 'GET' })
  .validator(z.object({ statusId: z.string().min(1).optional() }))
  .handler(async ({ data: input }): Promise<OrderListRow[]> => {
    const { statusId } = input as { statusId?: string };
    return withSessionDb((db, userId) => loadUserOrders(db, userId, statusId));
  });

/**
 * Одне замовлення власника сесії.
 *
 * Чуже замовлення повертає `null`, а не помилку: актором транзакції є
 * власник сесії, тож політика `orders_select_own_or_token` просто не віддає
 * рядок — сторінка показує «замовлення не знайдено».
 */
export const getMyOrder = createServerFn({ method: 'GET' })
  .validator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ data: input }): Promise<OrderDetailRow | null> => {
    const { orderId } = input as { orderId: string };
    return withSessionDb((db) => loadOrderDetail(db, orderId));
  });

/**
 * Скасувати власне замовлення — ОДНІЄЮ транзакцією. Уся логіка (право,
 * блокування, повернення залишку, статус) — у `cancelOwnOrder` лоадерів:
 * серверна обгортка лише відкриває транзакцію сесії й делегує.
 */
export const cancelMyOrder = createServerFn({ method: 'POST' })
  .validator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ data: input }): Promise<OrderCancelResult> => {
    const { orderId } = input as { orderId: string };
    return withSessionDb((db, _userId, operator) =>
      cancelOwnOrder(db, operator, orderId),
    );
  });
