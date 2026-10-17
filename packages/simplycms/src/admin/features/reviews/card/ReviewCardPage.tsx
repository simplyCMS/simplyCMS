import { useParams } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { productPath } from 'simplycms/domain';
import { useT } from 'simplycms/i18n';
import { StarRating } from 'simplycms/reviews-ui';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { RichHtml } from 'simplycms/ui/rich-html';
import { adminPath } from '../../../lib/adminLinks';
import { CardPageHeader } from '../../catalog-dictionaries/CardPageHeader';
import { NotFoundState } from '../../catalog-dictionaries/PageStates';
import ReviewAuthor from '../ReviewAuthor';
import ReviewStatusBadge from '../ReviewStatusBadge';
import ReviewModeration from './ReviewModeration';
import ReviewPhotos from './ReviewPhotos';
import { useReviewCard } from './useReviewCard';

/** Картка відгуку `/admin/reviews/$reviewId`: зміст, фото, модерація. */
export default function ReviewCardPage() {
  const t = useT();
  const { reviewId } = useParams({ strict: false }) as { reviewId: string };
  const { data: review, isPending, isError, refetch } = useReviewCard(reviewId);
  const back = adminPath('reviews');

  if (isPending)
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  if (isError)
    return (
      <div role="alert" className="space-y-4 py-12 text-center">
        <p className="text-destructive">{t('admin.reviews.loadError')}</p>
        <Button variant="outline" onClick={() => refetch()}>
          {t('admin.reviews.retry')}
        </Button>
      </div>
    );
  if (review === null)
    return (
      <NotFoundState backTo={back} message={t('admin.reviews.notFound')} />
    );

  const productUrl =
    review.productPath === null
      ? null
      : productPath({ path: review.productPath }).href;
  return (
    <div className="max-w-3xl space-y-6">
      <CardPageHeader
        backTo={back}
        title={t('admin.reviews.details')}
        action={<ReviewStatusBadge status={review.status} />}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('admin.reviews.product')}:{' '}
            {productUrl === null ? (
              review.productName
            ) : (
              <a
                href={productUrl}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {review.productName}
              </a>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <ReviewAuthor review={review} />
            <StarRating value={review.rating} size="sm" readonly />
          </div>
          {review.title && <h2 className="font-semibold">{review.title}</h2>}
          {review.content && <RichHtml html={review.content} />}
          <ReviewPhotos images={review.images} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <ReviewModeration key={review.updatedAt.getTime()} review={review} />
        </CardContent>
      </Card>
    </div>
  );
}
