import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import type { AdminOrder } from 'simplycms/admin-data';
import { parseShippingSnapshot } from 'simplycms/domain/shipping';

/**
 * Доставка зі знімка `shipping_data` (Е6а-8): назва способу й пункт такі, як
 * на момент оформлення, а не uuid точки, якої вже може не бути. Рядок
 * власний, а не `ShippingSnapshotLines` вітрини: адмінка показує підписані
 * поля, вітрина — вільний текст.
 */
export function OrderDeliveryCard({ order }: { readonly order: AdminOrder }) {
  const t = useT();
  const snapshot = parseShippingSnapshot(order.shippingData);
  const dest = snapshot?.destination;
  const rows: [string, string | null][] = [
    [t('admin.orders.methodLabel'), snapshot?.methodName ?? null],
    [t('admin.orders.cityLabel'), dest?.city ?? order.deliveryCity],
    [
      t('admin.orders.addressLabel'),
      (dest?.kind === 'address' ? dest.address : null) ??
        (dest ? null : order.deliveryAddress),
    ],
    [
      t('admin.orders.pickupPointLabel'),
      dest?.kind === 'pickup-point' ? `${dest.name}, ${dest.address}` : null,
    ],
    [
      t('cart.summary.shipping'),
      snapshot?.pricing === 'carrier'
        ? t('admin.orders.shippingCarrierNote')
        : null,
    ],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cart.summary.shipping')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {rows.map(([label, value]) =>
          value ? (
            <div key={label}>
              <span className="text-muted-foreground">{label}</span>
              <p className="font-medium">{value}</p>
            </div>
          ) : null,
        )}
      </CardContent>
    </Card>
  );
}
