import { useNavigate, useSearch } from '@tanstack/react-router';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import OrdersStatusFilter from './OrdersStatusFilter';
import OrdersTable from './OrdersTable';
import { adminPath } from '../../../lib/adminLinks';
import type { OrdersSearch } from './orders-search';
import { useOrdersList } from './useOrdersList';

/**
 * Список замовлень (Е5, Task 6) на on-demand колекції. Дані/пагінація —
 * `useOrdersList`; фільтр (стан у URL) і таблиця — окремі компоненти.
 */
export default function OrdersPage() {
  const t = useT();
  // Фільтр статусу живе в URL (Е6г-5): глибоке посилання з дашборду.
  const { status: statusId } = useSearch({ strict: false }) as OrdersSearch;
  const navigate = useNavigate();
  const setStatusId = (status: string | undefined) =>
    void navigate({ to: adminPath('orders'), search: { status } });
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useOrdersList({ statusId });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.nav.orders')}</h1>
        <p className="text-muted-foreground">{t('admin.orders.subtitle')}</p>
      </div>

      <OrdersStatusFilter statusId={statusId} onChange={setStatusId} />

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.orders.all')}</CardTitle>
        </CardHeader>
        <CardContent>
          <OrdersTable
            rows={data}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            onLoadMore={() => fetchNextPage()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
