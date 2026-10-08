import { Link } from '@tanstack/react-router';
import { eq, useLiveQuery } from '@tanstack/react-db';
import { ordersCollection, useCollection } from 'simplycms/admin-data';
import { useFormatPrice } from 'simplycms/react-query';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { adminPath } from '../../../lib/adminLinks';
import { toAmount } from '../../orders/to-amount';
import { useFormatDate } from './useFormatDate';

const RECENT_LIMIT = 10;

/** Останні замовлення покупця: зріз `where userId` наявної колекції. */
export default function CustomerRecentOrders({
  userId,
}: {
  readonly userId: string;
}) {
  const t = useT();
  const formatPrice = useFormatPrice();
  const formatDate = useFormatDate('short');
  const orders = useCollection(ordersCollection);
  const { data } = useLiveQuery({
    query: (q) =>
      q
        .from({ o: orders })
        .where(({ o }) => eq(o.userId, userId))
        .orderBy(({ o }) => o.createdAt, 'desc')
        .limit(RECENT_LIMIT),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.users.recentOrders')}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('admin.users.ordersEmpty')}
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {data.map((o) => (
              <li key={o.id} className="flex justify-between py-2">
                <Link
                  to={adminPath('orders/$orderId')}
                  params={{ orderId: o.id }}
                  className="font-medium hover:underline"
                >
                  {o.orderNumber}
                </Link>
                <span className="text-muted-foreground">
                  {formatDate(o.createdAt)}
                </span>
                <span>{formatPrice(toAmount(o.total))}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
