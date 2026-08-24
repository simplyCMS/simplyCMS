import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadOrderDetail,
  loadOrderStatuses,
  loadStatusByCode,
  loadUserOrders,
  setOrderStatus,
  withStorefrontDb,
  withStoreOperatorDb,
  type OrderDetailRow,
  type OrderListRow,
  type OrderStatusRow,
} from 'simplycms/storefront/loaders';
import { withSessionDb } from './session-db';

/** Код статусу, у який переводить скасування покупцем. */
const CANCELLED = 'cancelled';
/** Єдиний статус, з якого покупець ще сміє скасувати замовлення. */
const CANCELLABLE_FROM = 'new';

/** Довідник статусів для фільтра списку — публічне читання. */
export const getOrderStatuses = createServerFn({ method: 'GET' }).handler(
  async (): Promise<OrderStatusRow[]> =>
    withStorefrontDb((db) => loadOrderStatuses(db)),
);

/** Замовлення власника сесії, опційно звужені статусом. */
export const getMyOrders = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ statusId: z.string().min(1).optional() }))
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
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ data: input }): Promise<OrderDetailRow | null> => {
    const { orderId } = input as { orderId: string };
    return withSessionDb((db) => loadOrderDetail(db, orderId));
  });

/**
 * Скасувати власне замовлення.
 *
 * 🔴 Двоактна операція, і саме в такому порядку. Спершу читання ПІД
 * АКТОРОМ ПОКУПЦЯ: якщо замовлення чуже, RLS не віддасть рядок і далі справа
 * не піде. Лише потім — запис під `app_admin`, бо `0002_grants.sql` навмисно
 * не дає `app_user` UPDATE на `orders` (замовлення не редагується покупцем).
 * Переставити ці два кроки місцями означало б писати від імені адміна за
 * недоведеним правом.
 */
export const cancelMyOrder = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ data: input }): Promise<OrderCancelResult> => {
    const { orderId } = input as { orderId: string };

    const own = await withSessionDb((db) => loadOrderDetail(db, orderId));
    if (!own) return { ok: false, reason: 'not_found' };
    if (own.status?.code !== CANCELLABLE_FROM) {
      return { ok: false, reason: 'not_cancellable' };
    }

    const cancelled = await withStorefrontDb((db) =>
      loadStatusByCode(db, CANCELLED),
    );
    if (!cancelled) return { ok: false, reason: 'status_missing' };

    await withStoreOperatorDb((db) =>
      setOrderStatus(db, orderId, cancelled.id),
    );
    return { ok: true };
  });

/**
 * Результат скасування. Причина повертається КОДОМ, а не текстом: текст
 * помилки належить каталогу повідомлень, а не серверній відповіді.
 */
export type OrderCancelResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'not_found' | 'not_cancellable' | 'status_missing';
    };
