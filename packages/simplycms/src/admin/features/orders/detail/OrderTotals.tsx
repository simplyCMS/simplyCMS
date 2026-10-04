import { useFormatPrice } from 'simplycms/react-query';
import { useT } from 'simplycms/i18n';
import { toAmount } from '../to-amount';

interface Props {
  readonly subtotal: string;
  readonly shippingCost: string | null;
  readonly total: string;
}

/** Підсумок: товари, доставка й разом — окремими рядками. */
export function OrderTotals({ subtotal, shippingCost, total }: Props) {
  const t = useT();
  const fmt = useFormatPrice();
  const row = (label: string, value: string | null, bold = false) => (
    <div className={`flex justify-between ${bold ? 'text-lg font-bold' : ''}`}>
      <span>{label}</span>
      <span>{fmt(toAmount(value))}</span>
    </div>
  );
  return (
    <div className="space-y-1 pt-4 border-t">
      {row(t('cart.summary.itemsTotal'), subtotal)}
      {row(t('cart.summary.shipping'), shippingCost)}
      {row(t('admin.orders.totalSum'), total, true)}
    </div>
  );
}
