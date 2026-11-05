import { useQuery } from '@tanstack/react-query';
import { getOrderStatus } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';

/** Ключ агрегата статусу: варіант `order_statuses` + id. */
export const statusAggregateKey = (id: string) =>
  entityKey(ENTITY.orderStatuses).variant('admin-aggregate', id);

/**
 * Агрегат статусу (`order-statuses.get`) з усіма мовами. Без фонових перечитувань:
 * форма живе поверх знімка, мовчазна підміна дала б хибну різницю при збереженні.
 */
export function useStatusAggregate(id: string | undefined) {
  // cache-sync-ok: це читання (queryFn), а не мутація
  return useQuery({
    queryKey: statusAggregateKey(id ?? ''),
    queryFn: () => getOrderStatus({ data: { id: id! } }),
    enabled: !!id,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
