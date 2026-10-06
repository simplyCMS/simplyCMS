import { parseShippingSnapshot } from 'simplycms/domain/shipping';
import { useT } from 'simplycms/i18n';

/**
 * Доставка замовлення зі ЗНІМКА `orders.shipping_data` (Е6а-8): назва способу
 * й пункт — такі, якими їх бачив покупець. Живу точку чи спосіб тут не
 * читаємо: після перейменування чи видалення замовлення мусить лишатись
 * тим самим. Знімок, який не розібрався (старий рядок, `{}`), — «Не вказано».
 */
export function ShippingSnapshotLines({
  shippingData,
}: {
  readonly shippingData: unknown;
}) {
  const t = useT();
  const snapshot = parseShippingSnapshot(shippingData);
  if (!snapshot) return <p className="font-medium">{t('common.notSet')}</p>;

  const { destination } = snapshot;
  return (
    <>
      <p className="font-medium">{snapshot.methodName}</p>
      {destination.kind === 'pickup-point' ? (
        <>
          <p className="text-sm">{destination.name}</p>
          <p className="text-sm text-muted-foreground">
            {destination.city}, {destination.address}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {destination.city}
          {destination.address && `, ${destination.address}`}
        </p>
      )}
      {snapshot.pricing === 'carrier' && (
        <p className="text-sm text-muted-foreground">
          {t('orders.shipping.carrierNote')}
        </p>
      )}
    </>
  );
}
