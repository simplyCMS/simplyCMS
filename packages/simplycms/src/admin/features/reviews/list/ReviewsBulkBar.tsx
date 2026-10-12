import { useT } from 'simplycms/i18n';
import { Button } from 'simplycms/ui/button';
import type { ReviewStatus } from 'simplycms/contracts/objects';

/** Серверний ліміт `setReviewsStatus` (Е6д-7). */
export const BULK_LIMIT = 100;

interface Props {
  readonly count: number;
  readonly busy: boolean;
  readonly onApply: (status: ReviewStatus) => void;
}

/** Панель масових дій над вибраними відгуками; понад ліміт — неактивна. */
export default function ReviewsBulkBar({ count, busy, onApply }: Props) {
  const t = useT();
  if (count === 0) return null;
  const disabled = busy || count > BULK_LIMIT;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/40 p-3">
      <span className="text-sm">
        {t('admin.reviews.selectedCount', { count })}
      </span>
      <Button size="sm" disabled={disabled} onClick={() => onApply('approved')}>
        {t('admin.reviews.approveSelected')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => onApply('rejected')}
      >
        {t('admin.reviews.rejectSelected')}
      </Button>
    </div>
  );
}
