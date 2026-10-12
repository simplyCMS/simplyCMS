import { useQuery } from '@tanstack/react-query';
import { countPendingReviews } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';

export const PENDING_REVIEWS_KEY = entityKey(ENTITY.productReviews).variant(
  'admin-pending-count',
);

/**
 * Лічильник відгуків «на модерації» для шапки списку й сайдбара. Ключ без
 * фільтрів: число не залежить від того, що відфільтровано в списку.
 */
export function usePendingReviewsCount() {
  // cache-sync-ok: це читання (queryFn), а не мутація
  return useQuery({
    queryKey: PENDING_REVIEWS_KEY,
    queryFn: () => countPendingReviews(),
    staleTime: 60_000,
  });
}
