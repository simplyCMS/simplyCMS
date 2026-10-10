import { useInfiniteQuery } from '@tanstack/react-query';
import { listReviews } from 'simplycms/admin-server';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import type {
  AdminReviewCursor,
  ReviewStatus,
} from 'simplycms/contracts/objects';

export interface ReviewsFilters {
  /** `undefined` — «Всі». */
  readonly status?: ReviewStatus;
}

/** Ключ списку: варіант `product_reviews` + фільтри (зміна фільтра скидає курсор). */
export const REVIEWS_LIST_KEY = entityKey(ENTITY.productReviews).variant(
  'admin-reviews',
);

/** Список модерації на серверному читанні з keyset-курсором (Task 6). */
export function useReviewsList(filters: ReviewsFilters) {
  return useInfiniteQuery({
    queryKey: [...REVIEWS_LIST_KEY, filters],
    initialPageParam: undefined as AdminReviewCursor | undefined,
    queryFn: ({ pageParam }) =>
      listReviews({ data: { ...filters, cursor: pageParam } }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
}
