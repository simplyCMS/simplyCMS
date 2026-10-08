import { useQuery } from '@tanstack/react-query';
import { dashboardSummary } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';

/** Ключ зведення: варіант сутності замовлень, а не ключ колекції `admin-data`. */
export const DASHBOARD_KEY = entityKey(ENTITY.orders).variant(
  'admin-dashboard',
);

/** Зведення дашборду одним серверним читанням (Е6г-12, `order.manage`). */
export function useDashboardSummary() {
  // cache-sync-ok: це читання (queryFn), а не мутація
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: () => dashboardSummary(),
  });
}
