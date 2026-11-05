import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { localeOnlyInput } from 'simplycms/core/lib/locale-input';
import {
  cancelOwnOrder,
  loadOrderDetail,
  loadOrderStatuses,
  loadUserOrders,
  resolveTextLocale,
  withStorefrontDb,
  type OrderCancelResult,
  type OrderDetailRow,
  type OrderListRow,
  type OrderStatusRow,
  withSessionDb,
} from 'simplycms/storefront/loaders';

/** Довідник статусів для фільтра списку — публічне читання. */
export const getOrderStatuses = createServerFn({ method: 'GET' })
  .validator(localeOnlyInput)
  .handler(async ({ data: input }): Promise<OrderStatusRow[]> => {
    const text = await resolveTextLocale((input as { locale: string }).locale);
    return withStorefrontDb((db) => loadOrderStatuses(db, text));
  });

/** Замовлення власника сесії, опційно звужені статусом. */
export const getMyOrders = createServerFn({ method: 'GET' })
  .validator(localeOnlyInput.extend({ statusId: z.string().min(1).optional() }))
  .handler(async ({ data: input }): Promise<OrderListRow[]> => {
    const { statusId, locale } = input as { statusId?: string; locale: string };
    const text = await resolveTextLocale(locale);
    return withSessionDb((db, userId) =>
      loadUserOrders(db, userId, text, statusId),
    );
  });

/**
 * Одне замовлення власника сесії.
 *
 * Чуже замовлення повертає `null`, а не помилку: актором транзакції є
 * власник сесії, тож політика `orders_select_own_or_token` просто не віддає
 * рядок — сторінка показує «замовлення не знайдено».
 */
export const getMyOrder = createServerFn({ method: 'GET' })
  .validator(localeOnlyInput.extend({ orderId: z.string().uuid() }))
  .handler(async ({ data: input }): Promise<OrderDetailRow | null> => {
    const { orderId, locale } = input as { orderId: string; locale: string };
    const text = await resolveTextLocale(locale);
    return withSessionDb((db) => loadOrderDetail(db, orderId, text));
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
