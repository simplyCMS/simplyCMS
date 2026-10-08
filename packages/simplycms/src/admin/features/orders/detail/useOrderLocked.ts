import { orderStatusesCollection, useCollection } from 'simplycms/admin-data';
import { useLiveQuery } from '@tanstack/react-db';
import { ORDER_STATUS_CODE } from 'simplycms/contracts/order-status-codes';

/**
 * Позиції не редагуються, коли замовлення в статусі «Скасоване» — кінцевому
 * (Е5-2, Е5б-3) — або знеособлене (Е6г-16: покупця видалено, перерахунок
 * доставки без міста неможливий). Поки статуси не завантажені, вважаємо
 * замовлення нередагованим — контроли не мигтять і не з'являються на скасованому.
 */
export function useOrderLocked(
  statusId: string | null,
  personalDataErasedAt: Date | string | null = null,
): boolean {
  const col = useCollection(orderStatusesCollection);
  const { data: statuses, isLoading } = useLiveQuery({
    query: (q) => q.from({ s: col }),
  });
  if (isLoading || personalDataErasedAt !== null) return true;
  const cancelledId = statuses.find(
    (s) => s.code === ORDER_STATUS_CODE.cancelled,
  )?.id;
  return statusId !== null && statusId === cancelledId;
}
