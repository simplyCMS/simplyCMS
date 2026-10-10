import { Link } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import type { AdminReviewRow } from 'simplycms/contracts/objects';
import { adminPath } from '../../lib/adminLinks';

/**
 * Автор відгуку. `userId: null` — акаунт видалено (знеособлення): без
 * посилання, із позначкою «Колишній покупець».
 */
export default function ReviewAuthor({
  review,
}: {
  readonly review: Pick<
    AdminReviewRow,
    'userId' | 'authorName' | 'authorEmail'
  >;
}) {
  const t = useT();
  if (review.userId === null)
    return (
      <span className="text-muted-foreground">
        {t('admin.reviews.formerCustomer')}
      </span>
    );
  return (
    <Link
      to={adminPath('users/$userId')}
      params={{ userId: review.userId }}
      className="font-medium hover:underline"
    >
      {review.authorName ?? review.authorEmail ?? review.userId}
    </Link>
  );
}
