import { useT } from 'simplycms/i18n';
import { Card, CardContent, CardHeader, CardTitle } from 'simplycms/ui/card';
import type { AdminOrder } from 'simplycms/admin-data';

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="font-medium">{value}</p>
    </div>
  );
}

/** Клієнт, отримувач (якщо інший), оплата й нотатки — лише читання. */
export function OrderCustomerCard({ order }: { readonly order: AdminOrder }) {
  const t = useT();
  const email = t('admin.orders.emailLabel');
  const phone = t('admin.orders.phoneLabel');
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.orders.customerInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Field
            label={t('admin.orders.nameLabel')}
            value={`${order.firstName} ${order.lastName}`}
          />
          <Field label={email} value={order.email} />
          <Field label={phone} value={order.phone} />
        </CardContent>
      </Card>
      {order.hasDifferentRecipient && (
        <Card>
          <CardHeader>
            <CardTitle>{t('checkout.success.recipient')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Field
              label={t('admin.orders.nameLabel')}
              value={`${order.recipientFirstName ?? ''} ${order.recipientLastName ?? ''}`.trim()}
            />
            <Field label={phone} value={order.recipientPhone} />
            <Field label={email} value={order.recipientEmail} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t('checkout.success.payment')}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <Field
            label={t('admin.orders.methodLabel')}
            value={
              order.paymentMethod === 'cash'
                ? t('checkout.payment.cash')
                : order.paymentMethod
            }
          />
        </CardContent>
      </Card>
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.orders.comment')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{order.notes}</CardContent>
        </Card>
      )}
    </>
  );
}
