import { useParams } from '@tanstack/react-router';
import { useLocale, useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import { adminPath } from '../../../lib/adminLinks';
import { CardPageHeader } from '../../catalog-dictionaries/CardPageHeader';
import { NotFoundState } from '../../catalog-dictionaries/PageStates';
import { AddOrderItemDialog } from './AddOrderItemDialog';
import { OrderCustomerCard } from './OrderCustomerCard';
import { OrderDeliveryCard } from './OrderDeliveryCard';
import { OrderItemsTable } from './OrderItemsTable';
import { OrderStatusControl } from './OrderStatusControl';
import { OrderTotals } from './OrderTotals';
import { useOrderDetail } from './useOrderDetail';
import { useOrderLocked } from './useOrderLocked';

/** Серверний `maxLimit` позицій (Е5-12): рівно стільки — можливо, не всі. */
export const ORDER_ITEMS_MAX = 500;

/** Картка замовлення (Е5, Task 7): дані — колекції, зміна статусу — `OrderStatusControl`. */
export default function OrderDetailPage() {
  const t = useT();
  const locale = useLocale();
  const { orderId } = useParams({ strict: false }) as { orderId: string };
  const { order, items, isLoading } = useOrderDetail(orderId);
  const locked = useOrderLocked(order?.statusId ?? null);

  if (!order && isLoading)
    return <div className="p-8 text-center">{t('common.loading')}</div>;
  if (!order)
    return (
      <NotFoundState
        backTo={adminPath('orders')}
        message={t('admin.orders.notFound')}
      />
    );

  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(order.createdAt));

  return (
    <div className="space-y-6">
      <CardPageHeader
        backTo={adminPath('orders')}
        title={`${t('admin.orders.number')} ${order.orderNumber}`}
        subtitle={`${t('admin.orders.from')} ${date}`}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{t('admin.orders.items')}</CardTitle>
            {!locked && <AddOrderItemDialog orderId={order.id} />}
          </CardHeader>
          <CardContent>
            {items.length >= ORDER_ITEMS_MAX && (
              <p role="status" className="mb-3 text-sm text-amber-600">
                {t('admin.orders.itemsMayBeTruncated', {
                  count: ORDER_ITEMS_MAX,
                })}
              </p>
            )}
            <OrderItemsTable
              orderId={order.id}
              items={items}
              editable={!locked}
            />
            <OrderTotals
              subtotal={order.subtotal}
              shippingCost={order.shippingCost}
              total={order.total}
              shippingData={order.shippingData}
            />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <OrderStatusControl orderId={order.id} statusId={order.statusId} />
          <OrderCustomerCard order={order} />
          <OrderDeliveryCard order={order} />
        </div>
      </div>
    </div>
  );
}
