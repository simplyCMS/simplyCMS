import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { useAuth } from './useAuth';
import { useToast } from 'simplycms/ui/use-toast';
import { useT, type MessageKey } from 'simplycms/i18n';
import { REVIEW_SUBMIT_ERROR } from 'simplycms/contracts';
import { PAYLOAD_TOO_LARGE_CODE } from 'simplycms/domain/media';
import {
  deleteMyProductReview,
  submitProductReview,
  updateProductReview,
} from '../lib/review-form';
import { getProductRatings, getProductReviews } from '../lib/reviews';
import type { ProductReviewRow } from '../lib/reviews';

export type ProductReview = ProductReviewRow;

/** Коди відмови сервера -> ключі каталогу. */
const SUBMIT_ERROR_KEY: Record<string, MessageKey> = {
  [REVIEW_SUBMIT_ERROR.badImage]: 'reviews.errors.imageBadFormat',
  [REVIEW_SUBMIT_ERROR.imageTooLarge]: 'reviews.errors.imageTooLarge',
  [REVIEW_SUBMIT_ERROR.tooManyImages]: 'reviews.errors.tooManyImages',
  [REVIEW_SUBMIT_ERROR.alreadySubmitted]: 'reviews.alreadySubmitted',
  [REVIEW_SUBMIT_ERROR.notFound]: 'reviews.errors.notFound',
  [REVIEW_SUBMIT_ERROR.imagesChanged]: 'reviews.errors.changed',
  // Стеля тіла запиту (К3-Е6д-2): відмова приходить від міддлвари, не від хендлера.
  [PAYLOAD_TOO_LARGE_CODE]: 'errors.payloadTooLarge',
};

const NO_REVIEWS: ProductReview[] = [];

const productReviews = entityKey(ENTITY.productReviews);
/** Рейтинги — SQL-агрегат ПО ТІЙ САМІЙ таблиці `product_reviews`, тож ключ
 * розширює її список: інвалідація по entity зачепить обидва кеші разом. */
const productRatings = productReviews.variant('ratings');

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
    // Актор у ключі (Е6д-17): відповідь залежить від того, хто питає (автор
    // бачить свій `pending`). Без нього кеш гостя пережив би вхід, а кеш
    // покупця A показався б покупцю B.
    queryKey: [
      ...productReviews.scoped('product', productId ?? ''),
      user?.id ?? 'guest',
    ],
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

  // Коди сервера (`review/*`) у тост не потрапляють: кожен має рядок
  // каталогу, невідоме — загальний текст, а не сира серверна діагностика.
  // Власну відмову авторизації хук кидає вже перекладеною — її лишаємо.
  const onFailure = (err: Error) => {
    const key = SUBMIT_ERROR_KEY[err.message];
    const own = err.message === t('product.review.notAuthorized');
    toast({
      variant: 'destructive',
      title: t('common.error'),
      description: key ? t(key) : own ? err.message : t('common.saveError'),
    });
  };

  const submitReview = useMutation({
    mutationFn: async (data: {
      rating: number;
      title?: string;
      content?: string;
      images?: File[];
    }) => {
      // 🔴 Перевірка ЛИШАЄТЬСЯ, хоч автора й задає сервер: без неї відмова
      // приїхала б англійською серверною діагностикою просто в тост покупця.
      if (!user || !productId)
        throw new Error(t('product.review.notAuthorized'));
      // serverFn приймає `FormData` (Е6д-6): фото й текст їдуть одним
      // запитом. Порожні рядки сервер зводить до `null`.
      const form = new FormData();
      form.set('productId', productId);
      form.set('rating', String(data.rating));
      form.set('title', data.title ?? '');
      form.set('content', data.content ?? '');
      for (const file of data.images ?? []) form.append('images', file);
      await submitProductReview({ data: form });
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: t('product.review.submitted'),
        description: t('product.review.submittedDescription'),
      });
    },
    onError: onFailure,
  });

  // Правка (Е6д-23): `keep` — референси лишених фото, `images` — нові файли.
  // Той самий кеш і той самий ключ актора, що й подача: після успіху список
  // перечитується, і відгук приходить уже зі статусом `pending`.
  const updateReview = useMutation({
    mutationFn: async (data: {
      id: string;
      rating: number;
      title?: string;
      content?: string;
      keep: string[];
      images?: File[];
    }) => {
      if (!user) throw new Error(t('product.review.notAuthorized'));
      const form = new FormData();
      form.set('id', data.id);
      form.set('rating', String(data.rating));
      form.set('title', data.title ?? '');
      form.set('content', data.content ?? '');
      for (const ref of data.keep) form.append('keep', ref);
      for (const file of data.images ?? []) form.append('images', file);
      await updateProductReview({ data: form });
    },
    onSuccess: () => {
      invalidate();
      toast({
        title: t('reviews.edited'),
        description: t('product.review.submittedDescription'),
      });
    },
    onError: (err: Error) => {
      onFailure(err);
      // Відгук могли змінити чи видалити в іншій вкладці: форма працює зі
      // знімком, тож після відмови читаємо актуальний стан.
      invalidate();
    },
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
    onError: onFailure,
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
    updateReview,
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
