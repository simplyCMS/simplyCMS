import { useT } from 'simplycms/i18n';
import type { ReviewStatus } from 'simplycms/contracts/objects';
import { Badge } from 'simplycms/ui/badge';

const VARIANT = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
} as const;

/** Бейдж статусу відгуку (спільний для списку й картки). */
export default function ReviewStatusBadge({
  status,
}: {
  readonly status: ReviewStatus;
}) {
  const t = useT();
  return (
    <Badge variant={VARIANT[status]}>
      {t(`admin.reviews.status.${status}`)}
    </Badge>
  );
}
