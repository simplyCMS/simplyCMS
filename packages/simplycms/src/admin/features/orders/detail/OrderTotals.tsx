import { useFormatPrice } from 'simplycms/react-query';
import { useT } from 'simplycms/i18n';
import type { AdminOrder } from 'simplycms/admin-data';
import { parseShippingSnapshot } from 'simplycms/domain/shipping';
import { toAmount } from '../to-amount';

interface Props {
  readonly subtotal: string;
  readonly shippingCost: string | null;
  readonly total: string;
  readonly shippingData: AdminOrder['shippingData'];
}

/** Підсумок: товари, доставка й разом — окремими рядками. */
export function OrderTotals({
  subtotal,
  shippingCost,
  total,
  shippingData,
}: Props) {
  const t = useT();
  const fmt = useFormatPrice();
  // Е6а-4: для `carrier` доставка не входить у суму — «0,00 ₴» вводив би в
  // оману, тож замість числа підпис режиму, як у чекауті.
  const carrier = parseShippingSnapshot(shippingData)?.pricing === 'carrier';
  const row = (label: string, value: string, bold = false) => (
    <div className={`flex justify-between ${bold ? 'text-lg font-bold' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
  return (
    <div className="space-y-1 pt-4 border-t">
      {row(t('cart.summary.itemsTotal'), fmt(toAmount(subtotal)))}
      {row(
        t('cart.summary.shipping'),
        carrier ? t('checkout.shipping.carrier') : fmt(toAmount(shippingCost)),
      )}
      {row(t('admin.orders.totalSum'), fmt(toAmount(total)), true)}
    </div>
  );
}
