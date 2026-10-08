import { Link } from '@tanstack/react-router';
import { Banknote, ShoppingCart } from 'lucide-react';
import { useFormatPrice } from 'simplycms/react-query';
import { useT } from 'simplycms/i18n';
import type { AdminDashboardSummary } from 'simplycms/contracts/objects';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { adminPath } from '../../lib/adminLinks';

interface Props {
  readonly summary: AdminDashboardSummary | undefined;
}

/** Три картки: нові замовлення (глибоке посилання у фільтр) і виручка. */
export default function DashboardStatCards({ summary }: Props) {
  const t = useT();
  const formatPrice = useFormatPrice();
  const money = (cents: number | undefined) => formatPrice((cents ?? 0) / 100);
  const count = (
    <div className="text-2xl font-bold">{summary?.newOrders ?? 0}</div>
  );
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            {t('admin.dashboard.newOrders')}
          </CardTitle>
          <ShoppingCart className="h-5 w-5 text-orange-500" />
        </CardHeader>
        <CardContent>
          {summary?.newStatusId ? (
            <Link
              to={adminPath('orders')}
              search={{ status: summary.newStatusId }}
              className="hover:underline"
            >
              {count}
            </Link>
          ) : (
            count
          )}
        </CardContent>
      </Card>
      {(
        [
          ['admin.dashboard.revenue7d', summary?.revenue7dCents],
          ['admin.dashboard.revenue30d', summary?.revenue30dCents],
        ] as const
      ).map(([key, cents]) => (
        <Card key={key}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t(key)}</CardTitle>
            <Banknote className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(cents)}</div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
