import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadOrderDetail,
  withOrderTokenDb,
  type OrderDetailRow,
  optionalSessionUserId,
  withSessionDb,
} from 'simplycms/storefront/loaders';

/**
 * Замовлення для сторінки «замовлення прийнято».
 *
 * Два взаємовиключні шляхи доступу, і обидва доводяться АКТОРОМ транзакції,
 * а не предикатом у запиті:
 *   • залогінений покупець — `app_user` + `app.user_id` із сесії;
 *   • гість — `app_user` + `app.order_token` із посилання.
 *
 * 🔴 Токен приймається лише тоді, коли сесії немає. Інакше залогінений
 * користувач із чужим токеном у URL відкрив би чуже замовлення — а це рівно
 * той випадок, коли «зайва» гілка доступу коштує витоку.
 */
export const getOrderView = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      orderId: z.string().uuid(),
      token: z.string().min(1).nullable(),
    }),
  )
  .handler(async ({ data: input }): Promise<OrderDetailRow | null> => {
    const { orderId, token } = input as {
      orderId: string;
      token: string | null;
    };

    const userId = await optionalSessionUserId();
    if (userId) return withSessionDb((db) => loadOrderDetail(db, orderId));
    if (!token) return null;

    return withOrderTokenDb(token, (db) => loadOrderDetail(db, orderId));
  });
