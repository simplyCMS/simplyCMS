import { Link } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import type { AdminReviewRow } from 'simplycms/contracts/objects';
import { StarRating } from 'simplycms/reviews-ui';
import { Button } from 'simplycms/ui/button';
import { Checkbox } from 'simplycms/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { adminPath } from '../../../lib/adminLinks';
import { useFormatDate } from '../../customers/card/useFormatDate';
import ReviewAuthor from '../ReviewAuthor';
import ReviewStatusBadge from '../ReviewStatusBadge';

interface Props {
  readonly rows: readonly AdminReviewRow[];
  readonly selected: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
  readonly onToggleAll: (checked: boolean) => void;
  readonly isPending: boolean;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly onLoadMore: () => void;
}

/** Таблиця модерації: чекбокси, автор, товар, рейтинг, статус, «Показати ще». */
export default function ReviewsTable(p: Props) {
  const t = useT();
  const fmt = useFormatDate('short');
  const allChecked =
    p.rows.length > 0 && p.rows.every((r) => p.selected.has(r.id));
  const span = 7;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              aria-label={t('admin.reviews.selectAll')}
              checked={allChecked}
              onCheckedChange={(v) => p.onToggleAll(v === true)}
            />
          </TableHead>
          <TableHead>{t('admin.reviews.colProduct')}</TableHead>
          <TableHead>{t('admin.reviews.colAuthor')}</TableHead>
          <TableHead>{t('admin.reviews.rating')}</TableHead>
          <TableHead>{t('admin.reviews.colStatus')}</TableHead>
          <TableHead>{t('admin.reviews.colDate')}</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {p.rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <Checkbox
                aria-label={t('admin.reviews.selectRow')}
                checked={p.selected.has(r.id)}
                onCheckedChange={() => p.onToggle(r.id)}
              />
            </TableCell>
            <TableCell>
              <Link
                to={adminPath('reviews/$reviewId')}
                params={{ reviewId: r.id }}
                className="font-medium hover:underline"
              >
                {r.productName}
              </Link>
              {r.title && (
                <div className="text-sm text-muted-foreground">{r.title}</div>
              )}
            </TableCell>
            <TableCell>
              <ReviewAuthor review={r} />
            </TableCell>
            <TableCell>
              <StarRating value={r.rating} size="sm" readonly />
            </TableCell>
            <TableCell>
              <ReviewStatusBadge status={r.status} />
            </TableCell>
            <TableCell>{fmt(r.createdAt)}</TableCell>
            <TableCell />
          </TableRow>
        ))}
        {p.rows.length === 0 && !p.isPending && (
          <TableRow>
            <TableCell
              colSpan={span}
              className="text-center text-muted-foreground"
            >
              {t('admin.reviews.empty')}
            </TableCell>
          </TableRow>
        )}
        {p.isPending && (
          <TableRow>
            <TableCell colSpan={span} className="text-center">
              <Loader2
                aria-label={t('common.loading')}
                className="mx-auto h-6 w-6 animate-spin"
              />
            </TableCell>
          </TableRow>
        )}
        {p.hasNextPage && (
          <TableRow>
            <TableCell colSpan={span} className="text-center">
              <Button
                variant="outline"
                size="sm"
                disabled={p.isFetchingNextPage}
                onClick={p.onLoadMore}
              >
                {p.isFetchingNextPage && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t('admin.reviews.loadMore')}
              </Button>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
