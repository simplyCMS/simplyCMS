import { useQuery } from '@tanstack/react-query';
import { getReviewCard } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';

/** Ключ картки: варіант `product_reviews` + id відгуку. */
export const reviewCardKey = (id: string) =>
  entityKey(ENTITY.productReviews).variant('admin-review', id);

/** Картка на серверному читанні; `null` з сервера — «не знайдено». */
export function useReviewCard(id: string) {
  // cache-sync-ok: це читання (queryFn), а не мутація
  return useQuery({
    queryKey: reviewCardKey(id),
    queryFn: () => getReviewCard({ data: { id } }),
  });
}
