import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { useAuth } from './useAuth';
import { useToast } from 'simplycms/ui/use-toast';
import { useT } from 'simplycms/i18n';
import { deleteMyProductReview, submitProductReview } from '../lib/review-form';
import { getProductRatings, getProductReviews } from '../lib/reviews';
import type { ProductReviewRow } from '../lib/reviews';

export type ProductReview = ProductReviewRow;

const NO_REVIEWS: ProductReview[] = [];

const productReviews = entityKey(ENTITY.productReviews);
/** Рейтинги — SQL-агрегат ПО ТІЙ САМІЙ таблиці `product_reviews`, тож ключ
 * розширює її список: інвалідація по entity зачепить обидва кеші разом. */
const productRatings = [...productReviews.list(), 'ratings'] as const;

/**
 * Відгуки товару, рейтинг і власний відгук покупця.
 *
 * 🔴 Список звужує АКТОР серверної транзакції, а не клієнт: анонім дістає
 * лише `approved`, залогінений — ще й власні `pending` (політика
 * `product_reviews_select_approved_or_own`). Раніше браузер тягнув усі рядки
 * таблиці й фільтрував їх у пам'яті, а імена авторів добирав окремим запитом
 * до `profiles` — тобто чужі нерозглянуті відгуки їхали в клієнт.
 */
export function useProductReviews(productId: string | undefined) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const t = useT();

  const reviewsQuery = useQuery({
    queryKey: productReviews.scoped('product', productId ?? ''),
    queryFn: () => getProductReviews({ data: { productId: productId! } }),
    enabled: !!productId,
    staleTime: 60 * 1000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: productReviews.scoped('product', productId ?? ''),
    });
    void queryClient.invalidateQueries({ queryKey: productRatings });
  };

  const onError = (err: Error) =>
    toast({
      variant: 'destructive',
      title: t('common.error'),
      description: err.message,
    });

  const submitReview = useMutation({
    mutationFn: async (data: {
      rating: number;
      title?: string;
      content?: string;
      images?: string[];
    }) => {
      // 🔴 Перевірка ЛИШАЄТЬСЯ, хоч автора й задає сервер: без неї відмова
      // приїхала б англійською серверною діагностикою просто в тост покупця.
      if (!user || !productId)
        throw new Error(t('product.review.notAuthorized'));
      await submitProductReview({
        data: {
          productId,
          rating: data.rating,
          title: data.title || null,
          content: data.content || null,
          images: data.images ?? [],
        },
      });
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: t('product.review.submitted'),
        description: t('product.review.submittedDescription'),
      });
    },
    onError,
  });

  const deleteReview = useMutation({
    mutationFn: async (reviewId: string) => {
      // `false` — рядка немає або він чужий: RLS лишила `returning` порожнім.
      // Тихий «успіх» тут показав би відгук видаленим, доки сторінка не
      // перезавантажиться.
      const deleted = await deleteMyProductReview({ data: { reviewId } });
      if (!deleted) throw new Error(t('product.review.notAuthorized'));
    },
    onSuccess: () => {
      invalidate();
      toast({ title: t('product.review.deleted') });
    },
    onError,
  });

  const reviews = reviewsQuery.data ?? NO_REVIEWS;
  const approvedReviews = reviews.filter((r) => r.status === 'approved');
  const userReview = user ? reviews.find((r) => r.user_id === user.id) : null;

  return {
    reviews,
    approvedReviews,
    userReview,
    hasUserReview: !!userReview,
    ...summarize(approvedReviews),
    isLoading: reviewsQuery.isLoading,
    submitReview,
    deleteReview,
  };
}

/** Середнє й розподіл зірок — рахуються ЛИШЕ по схвалених відгуках. */
function summarize(approved: ProductReview[]) {
  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const review of approved) {
    distribution[review.rating] = (distribution[review.rating] || 0) + 1;
  }
  const reviewCount = approved.length;
  const sum = approved.reduce((total, r) => total + r.rating, 0);

  return {
    reviewCount,
    avgRating: reviewCount > 0 ? Math.round((sum / reviewCount) * 10) / 10 : 0,
    distribution,
  };
}

/**
 * Рейтинги пачки товарів для сітки каталогу.
 *
 * 🔴 Заміна `rpc('get_product_ratings')` — функції, якої в схемі v2 немає,
 * тож зірки в каталозі не малювались узагалі. Агрегат рахує SQL і ЛИШЕ по
 * `status = 'approved'` (див. `loadProductRatings`).
 */
export function useProductRatings(productIds: string[]) {
  return useQuery({
    queryKey: [...productRatings, productIds] as const,
    queryFn: () => getProductRatings({ data: { productIds } }),
    enabled: productIds.length > 0,
    staleTime: 60 * 1000,
  });
}
