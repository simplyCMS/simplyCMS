import { Link } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useFormatPrice } from 'simplycms/react-query';
import { useT } from 'simplycms/i18n';
import type { AdminCustomerRow } from 'simplycms/contracts/objects';
import { Badge } from 'simplycms/ui/badge';
import { Button } from 'simplycms/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { adminPath } from '../../../lib/adminLinks';

interface Props {
  readonly rows: readonly AdminCustomerRow[];
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly onLoadMore: () => void;
}

/** Таблиця покупців: рядок — посилання на картку, «Показати ще» під нею. */
export default function CustomersTable({
  rows,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: Props) {
  const t = useT();
  const formatPrice = useFormatPrice();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.users.user')}</TableHead>
          <TableHead>{t('admin.users.category')}</TableHead>
          <TableHead>{t('admin.users.ordersCount')}</TableHead>
          <TableHead>{t('admin.users.totalSpent')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.userId} className="hover:bg-muted/50">
            <TableCell>
              <Link
                to={adminPath('users/$userId')}
                params={{ userId: c.userId }}
                className="font-medium hover:underline"
              >
                {c.name ?? c.email}
              </Link>
              <div className="text-sm text-muted-foreground">{c.email}</div>
              <div className="mt-1 flex gap-1">
                {c.isAdmin && <Badge>{t('admin.users.adminBadge')}</Badge>}
                {c.bannedAt && (
                  <Badge variant="destructive">{t('admin.users.banned')}</Badge>
                )}
              </div>
            </TableCell>
            <TableCell>{c.categoryName ?? '—'}</TableCell>
            <TableCell>{c.ordersCount}</TableCell>
            <TableCell>{formatPrice(c.ordersTotalCents / 100)}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={4}
              className="text-center text-muted-foreground"
            >
              {t('admin.users.empty')}
            </TableCell>
          </TableRow>
        )}
        {hasNextPage && (
          <TableRow>
            <TableCell colSpan={4} className="text-center">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetchingNextPage}
                onClick={onLoadMore}
              >
                {isFetchingNextPage && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t('admin.users.loadMore')}
              </Button>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
