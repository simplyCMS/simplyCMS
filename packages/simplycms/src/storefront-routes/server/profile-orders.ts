import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  lockOrderStatus,
  loadOrderDetail,
  loadOrderStatuses,
  loadStatusByCode,
  loadUserOrders,
  releaseOrderStock,
  setOrderStatus,
  withStorefrontDb,
  type OrderDetailRow,
  type OrderListRow,
  type OrderStatusRow,
  withSessionDb,
} from 'simplycms/storefront/loaders';

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
 * Скасувати власне замовлення — ОДНІЄЮ транзакцією.
 *
 * 🔴 Право доводиться читанням під актором покупця (RLS віддасть рядок лише
 * власнику), запис — ескалацією в ТІЙ САМІЙ транзакції. Три транзакції ред.
 * до К2-Е0 лишали вікно між «перевірив» і «записав», а тепер вікна немає за
 * побудовою: між перевіркою і записом транзакція не завершується.
 *
 * 🔴 Порядок усередині ескалації обовʼязковий: блокування рядка замовлення →
 * повернення залишку → статус. Повернення ПІСЛЯ статусу лишало б стан, у
 * якому замовлення вже скасоване, а склад ще ні.
 *
 * 🔴 `loadStatusByCode` тепер читається під актором покупця, а не окремою
 * транзакцією вітрини: `order_statuses` — публічний довідник із грантом
 * SELECT для `app_user` (`0002_grants.sql:71`), тож зайва транзакція була
 * лише історією.
 */
export const cancelMyOrder = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ orderId: z.string().uuid() }))
  .handler(async ({ data: input }): Promise<OrderCancelResult> => {
    const { orderId } = input as { orderId: string };
    return withSessionDb(async (db, _userId, operator) => {
      const own = await loadOrderDetail(db, orderId);
      if (!own) return { ok: false, reason: 'not_found' };
      if (own.status?.code !== CANCELLABLE_FROM) {
        return { ok: false, reason: 'not_cancellable' };
      }
      const cancelled = await loadStatusByCode(db, CANCELLED);
      if (!cancelled) return { ok: false, reason: 'status_missing' };

      const done = await operator(async (odb) => {
        const locked = await lockOrderStatus(odb, orderId);
        // Хтось випередив (подвійний клік, адмінка) — повернення НЕ повторюємо.
        if (!locked || locked.statusId !== own.status_id) return false;
        await releaseOrderStock(odb, orderId);
        await setOrderStatus(odb, orderId, cancelled.id);
        return true;
      });

      return done ? { ok: true } : { ok: false, reason: 'not_cancellable' };
    });
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
