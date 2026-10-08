import { useMemo } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { Link } from '@tanstack/react-router';
import { orderStatusesCollection, useCollection } from 'simplycms/admin-data';
import { useLocale, useT } from 'simplycms/i18n';
import { useFormatPrice } from 'simplycms/react-query';
import type { AdminDashboardRecentOrder } from 'simplycms/contracts/objects';
import { Badge } from 'simplycms/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'simplycms/ui/table';
import { adminPath } from '../../lib/adminLinks';

interface Props {
  readonly orders: readonly AdminDashboardRecentOrder[];
}

/** 10 останніх замовлень; назва статусу — з eager-довідника статусів. */
export default function RecentOrdersCard({ orders }: Props) {
  const t = useT();
  const locale = useLocale();
  const formatPrice = useFormatPrice();
  const statuses = useCollection(orderStatusesCollection);
  const { data: rows } = useLiveQuery({
    query: (q) => q.from({ s: statuses }),
  });
  const byId = useMemo(() => new Map(rows.map((s) => [s.id, s])), [rows]);
  const formatDate = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [locale],
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.dashboard.recentOrders')}</CardTitle>
      </CardHeader>
      <CardContent>
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
            {orders.map((o) => {
              const status = o.statusId ? byId.get(o.statusId) : undefined;
              return (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">
                    <Link
                      to={adminPath('orders/$orderId')}
                      params={{ orderId: o.id }}
                    >
                      {o.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {o.erased
                      ? t('admin.orders.erasedCustomer')
                      : (o.customerName ?? '—')}
                  </TableCell>
                  <TableCell>{formatPrice(o.totalCents / 100)}</TableCell>
                  <TableCell>
                    <Badge
                      style={{ backgroundColor: status?.color ?? '#6B7280' }}
                    >
                      {status?.name ?? t('admin.orders.noStatus')}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate.format(o.createdAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
