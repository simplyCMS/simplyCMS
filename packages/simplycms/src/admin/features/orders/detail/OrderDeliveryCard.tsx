import type { MessageKey } from 'simplycms/i18n';
import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import type { AdminOrder } from 'simplycms/admin-data';

const METHOD_KEYS: Record<string, MessageKey> = {
  pickup: 'checkout.shipping.pickup',
  nova_poshta: 'checkout.shipping.novaPoshta',
  courier: 'checkout.shipping.courier',
};

/** Доставка: метод за кодом, місто, адреса, точка видачі. */
export function OrderDeliveryCard({ order }: { readonly order: AdminOrder }) {
  const t = useT();
  const key = order.deliveryMethod ? METHOD_KEYS[order.deliveryMethod] : null;
  const rows: [string, string | null][] = [
    [
      t('admin.orders.methodLabel'),
      key ? t(key) : (order.deliveryMethod ?? null),
    ],
    [t('admin.orders.cityLabel'), order.deliveryCity],
    [t('admin.orders.addressLabel'), order.deliveryAddress],
    [t('admin.orders.pickupPointLabel'), order.pickupPointId],
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
