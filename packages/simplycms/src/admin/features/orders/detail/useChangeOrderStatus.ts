import { useQueryClient } from '@tanstack/react-query';
import {
  invalidateCollection,
  orderItemsCollection,
  ordersCollection,
  productModificationsCollection,
  productsCollection,
  stockCollection,
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
 * 🔴 Скасування змінює й СУСІДНІ таблиці: `releaseOrderStock` обнуляє
 * `order_items.stock_reserved`, повертає резерв у `stock_by_pickup_point` і
 * перераховує `stock_status` товару/модифікації, а сервер цих рядків не
 * повертає. Write-back покриває лише власну таблицю (`admin-data/handlers.ts`),
 * тож позиції, залишки, товари й модифікації інвалідуємо явно
 * (`invalidateCollection`, не `utils.refetch()`: зріз без спостерігача той не
 * бачить). Без цього діалог залишків показав би застарілі кількості, а його
 * «Зберегти» надсилає кількості ВСІХ пунктів і перезаписав би повернений резерв.
 */
export function useChangeOrderStatus(): (
  orderId: string,
  statusId: string,
) => Promise<void> {
  const t = useT();
  const orders = useCollection(ordersCollection);
  const queryClient = useQueryClient();
  return async (orderId, statusId) => {
    try {
      const { order } = await changeOrderStatus({
        data: { orderId, statusId },
      });
      await orders.utils.writeBatch(() => {
        orders.utils.writeUpsert(order);
      });
      await Promise.all([
        invalidateCollection(queryClient, orderItemsCollection),
        invalidateCollection(queryClient, stockCollection),
        invalidateCollection(queryClient, productsCollection),
        invalidateCollection(queryClient, productModificationsCollection),
      ]);
    } catch (e) {
      reportTxError(t, e);
    }
  };
}
