import { CART_REQUISITES } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { useCart, useFormatPrice } from 'simplycms/react-query';
import { Separator } from 'simplycms/ui/separator';
import { cn } from 'simplycms/ui/utils';

export interface CartSummaryProps {
  className?: string;
}

/**
 * Реквізит «підсумок замовлення»: сума позицій, доставка, разом.
 *
 * 🔴 Вертикальні відступи (`space-y-4`) переїхали з `CardContent` сторінки в
 * КОРІНЬ слота: обгортка з `display: contents` тут не годиться — `space-y-*`
 * добирає лише прямих дітей, і рядки підсумку втратили б відступи.
 */
export function CartSummary({ className }: CartSummaryProps) {
  const t = useT();
  const { totalPrice } = useCart();
  const formatPrice = useFormatPrice();

  return (
    <div
      data-simplycms-requisite={CART_REQUISITES.Summary}
      className={cn('space-y-4', className)}
    >
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          {t('cart.summary.itemsTotal')}
        </span>
        <span>{formatPrice(totalPrice)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          {t('cart.summary.shipping')}
        </span>
        <span className="text-muted-foreground">
          {t('cart.summary.shippingHint')}
        </span>
      </div>
      <Separator />
      <div className="flex justify-between font-semibold text-lg">
        <span>{t('cart.summary.total')}</span>
        <span className="text-primary">{formatPrice(totalPrice)}</span>
      </div>
    </div>
  );
}
