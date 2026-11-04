import {
  orderItemsCollection,
  ordersCollection,
  useCollection,
} from 'simplycms/admin-data';
import { changeOrderStatus } from 'simplycms/admin-server';
import { useT } from 'simplycms/i18n';
import { reportTxError } from '../../../lib/report-tx-error';

/**
 * Зміна статусу замовлення: іменована операція (повернення залишку при
 * скасуванні робить сервер), повернений рядок — write-back у колекцію без
 * refetch (К3-7). Помилка (зокрема 409 «скасоване — кінцеве») — тост, а
 * стан колекції лишається незмінним, бо write-back до `throw` не доходить.
 *
 * 🔴 Скасування змінює й СУСІДНЮ таблицю: `releaseOrderStock` обнуляє
 * `order_items.stock_reserved`, а сервер позицій не повертає. Write-back
 * покриває лише власну таблицю (`admin-data/handlers.ts`), тож живий зріз
 * позицій цього замовлення перечитуємо явно.
 */
export function useChangeOrderStatus(): (
  orderId: string,
  statusId: string,
) => Promise<void> {
  const t = useT();
  const orders = useCollection(ordersCollection);
  const items = useCollection(orderItemsCollection);
  return async (orderId, statusId) => {
    try {
      const { order } = await changeOrderStatus({
        data: { orderId, statusId },
      });
      await orders.utils.writeBatch(() => {
        orders.utils.writeUpsert(order);
      });
      await items.utils.refetch();
    } catch (e) {
      reportTxError(t, e);
    }
  };
}
