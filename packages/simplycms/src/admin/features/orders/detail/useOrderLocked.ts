import { orderStatusesCollection, useCollection } from 'simplycms/admin-data';
import { useLiveQuery } from '@tanstack/react-db';
import { ORDER_STATUS_CODE } from 'simplycms/contracts/order-status-codes';

/**
 * Замовлення в статусі «Скасоване» — кінцеве (Е5-2, Е5б-3): редагувати не
 * можна. Поки статуси не завантажені, вважаємо замовлення нередагованим —
 * контроли не мигтять і не з'являються на скасованому.
 */
export function useOrderLocked(statusId: string | null): boolean {
  const col = useCollection(orderStatusesCollection);
  const { data: statuses, isLoading } = useLiveQuery((q) => q.from({ s: col }));
  if (isLoading) return true;
  const cancelledId = statuses.find(
    (s) => s.code === ORDER_STATUS_CODE.cancelled,
  )?.id;
  return statusId !== null && statusId === cancelledId;
}
