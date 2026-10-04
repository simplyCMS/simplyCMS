import { releaseOrderStock } from 'simplycms/inventory';
import { ORDER_STATUS_CODE } from 'simplycms/contracts/order-status-codes';
import type { ActorDb, OperatorEscalation } from './db';
import { loadStatusByCode } from './order-statuses';
import { loadOrderDetail, lockOrderStatus, setOrderStatus } from './orders';

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

/**
 * Скасувати власне замовлення покупця — ядро операції кабінету.
 *
 * Це звичайна функція, а не serverFn: тест одночасного скасування ганяє
 * саме цей код у харнесі (serverFn там не викликається — немає контексту
 * запиту), тож логіка не може жити лише всередині обгортки.
 *
 * 🔴 Право доводиться читанням під актором покупця (RLS віддасть рядок лише
 * власнику), запис — ескалацією в ТІЙ САМІЙ транзакції: між перевіркою і
 * записом транзакція не завершується, вікна немає за побудовою.
 *
 * 🔴 Порядок усередині ескалації обовʼязковий: блокування рядка замовлення →
 * повернення залишку → статус. Повернення ПІСЛЯ статусу лишало б стан, у
 * якому замовлення вже скасоване, а склад ще ні.
 *
 * 🔴 `loadStatusByCode` читається під актором покупця: `order_statuses` —
 * публічний довідник із грантом SELECT для `app_user`.
 */
export async function cancelOwnOrder(
  db: ActorDb,
  operator: OperatorEscalation,
  orderId: string,
): Promise<OrderCancelResult> {
  const own = await loadOrderDetail(db, orderId);
  if (!own) return { ok: false, reason: 'not_found' };
  if (own.status?.code !== ORDER_STATUS_CODE.new) {
    return { ok: false, reason: 'not_cancellable' };
  }
  const cancelled = await loadStatusByCode(db, ORDER_STATUS_CODE.cancelled);
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
}
