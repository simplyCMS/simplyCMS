import { Link } from '@tanstack/react-router';
import { useFormatPrice } from 'simplycms/react-query';
import { useLocale, useT } from 'simplycms/i18n';
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
import { Loader2 } from 'lucide-react';
import { adminPath } from '../../../lib/adminLinks';
import { toAmount } from '../to-amount';
import type { useOrdersList } from './useOrdersList';

type Row = ReturnType<typeof useOrdersList>['data'][number];

interface Props {
  readonly rows: readonly Row[];
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly onLoadMore: () => void;
}

/** Таблиця замовлень: кожен рядок — `<Link>` на картку, «Показати ще». */
export default function OrdersTable({
  rows,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: Props) {
  const t = useT();
  const locale = useLocale();
  const formatPrice = useFormatPrice();
  const formatDate = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  // Комірка-посилання: клік і клавіатура працюють як у звичайного <a>.
  const cell = (id: string, className?: string) => ({
    className,
    to: adminPath('orders/$orderId'),
    params: { orderId: id },
  });
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.orders.number')}</TableHead>
          <TableHead>{t('admin.orders.customer')}</TableHead>
          <TableHead>{t('common.amount')}</TableHead>
          <TableHead>{t('common.status')}</TableHead>
          <TableHead>{t('common.date')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((o) => (
          <TableRow key={o.id} className="hover:bg-muted/50">
            <TableCell className="font-medium">
              <Link {...cell(o.id)}>{o.orderNumber}</Link>
            </TableCell>
            <TableCell>
              <div>
                {o.firstName} {o.lastName}
              </div>
              <div className="text-sm text-muted-foreground">{o.email}</div>
            </TableCell>
            <TableCell>{formatPrice(toAmount(o.total))}</TableCell>
            <TableCell>
              <Badge style={{ backgroundColor: o.statusColor ?? '#6B7280' }}>
                {o.statusName ?? t('admin.orders.noStatus')}
              </Badge>
            </TableCell>
            <TableCell>{formatDate.format(new Date(o.createdAt))}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={5}
              className="text-center text-muted-foreground"
            >
              {t('admin.orders.empty')}
            </TableCell>
          </TableRow>
        )}
        {hasNextPage && (
          <TableRow>
            <TableCell colSpan={5} className="text-center">
              <Button
                variant="outline"
                size="sm"
                disabled={isFetchingNextPage}
                onClick={onLoadMore}
              >
                {isFetchingNextPage && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {t('admin.orders.loadMore')}
              </Button>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
