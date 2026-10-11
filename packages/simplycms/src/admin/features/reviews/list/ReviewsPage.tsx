import { useState } from 'react';
import { useT } from 'simplycms/i18n';
import {
  REVIEW_STATUSES,
  type ReviewStatus,
} from 'simplycms/contracts/objects';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import { Card, CardContent } from 'simplycms/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'simplycms/ui/select';
import { useSetReviewsStatus } from '../useSetReviewsStatus';
import ReviewsBulkBar from './ReviewsBulkBar';
import ReviewsTable from './ReviewsTable';
import { usePendingReviewsCount } from './usePendingReviewsCount';
import { useReviewsList } from './useReviewsList';

const ALL = 'all';
const STATUS_LABEL = {
  pending: 'admin.reviews.status.pending',
  approved: 'admin.reviews.approvedPlural',
  rejected: 'admin.reviews.rejectedPlural',
} as const;

/** Модерація відгуків `/admin/reviews`: фільтр, масові дії, бейдж «очікують». */
export default function ReviewsPage() {
  const t = useT();
  const [status, setStatus] = useState<ReviewStatus>();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const list = useReviewsList({ status });
  const pending = usePendingReviewsCount();
  const setStatuses = useSetReviewsStatus();
  const rows = list.data?.pages.flatMap((p) => p.rows) ?? [];

  const changeFilter = (v: string) => {
    setStatus(v === ALL ? undefined : (v as ReviewStatus));
    setSelected(new Set()); // вибір належить попередньому зрізу
  };
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const apply = async (to: ReviewStatus) => {
    setBusy(true);
    const outcome = await setStatuses(
      rows.filter((r) => selected.has(r.id)),
      to,
    );
    setBusy(false);
    // Вибір знімаємо і після успіху, і після 409: id могли зникнути.
    if (outcome !== 'failed') setSelected(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.nav.reviews')}</h1>
          <p className="text-muted-foreground">{t('admin.reviews.subtitle')}</p>
        </div>
        {pending.data && pending.data.pending > 0 && (
          <Badge variant="secondary">
            {t('admin.reviews.pending', { count: pending.data.pending })}
          </Badge>
        )}
      </div>
      <Select value={status ?? ALL} onValueChange={changeFilter}>
        <SelectTrigger
          className="w-56"
          aria-label={t('admin.reviews.statusFilter')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('admin.reviews.all')}</SelectItem>
          {REVIEW_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(STATUS_LABEL[s])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ReviewsBulkBar count={selected.size} busy={busy} onApply={apply} />
      <Card>
        <CardContent className="pt-6">
          {list.isError && !list.data ? (
            <div role="alert" className="space-y-4 py-8 text-center">
              <p className="text-destructive">{t('admin.reviews.loadError')}</p>
              <Button variant="outline" onClick={() => list.refetch()}>
                {t('admin.reviews.retry')}
              </Button>
            </div>
          ) : (
            <ReviewsTable
              rows={rows}
              selected={selected}
              onToggle={toggle}
              onToggleAll={(c) =>
                setSelected(c ? new Set(rows.map((r) => r.id)) : new Set())
              }
              isPending={list.isPending}
              hasNextPage={list.hasNextPage}
              isFetchingNextPage={list.isFetchingNextPage}
              onLoadMore={() => list.fetchNextPage()}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
