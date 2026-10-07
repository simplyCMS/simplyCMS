import { CART_REQUISITES } from 'simplycms/contracts/views';
import { useT } from 'simplycms/i18n';
import { useFormatPrice } from 'simplycms/react-query';
import { PriceSkeleton, QuoteFailure } from 'simplycms/cart-ui';
import { useCartQuote } from 'simplycms/core/hooks/useCartQuote';
import { Separator } from 'simplycms/ui/separator';
import { cn } from 'simplycms/ui/utils';

export interface CartSummaryProps {
  className?: string;
}

/**
 * Реквізит «підсумок замовлення»: сума позицій, доставка, разом.
 *
 * 🔴 Сума — лише `subtotal` серверної квоти кошика (Е6в-13): ціни зі знижками
 * рахує сервер тим самим ядром, що й чек. До першої квоти — скелет, а не 0.
 *
 * 🔴 Вертикальні відступи (`space-y-4`) переїхали з `CardContent` сторінки в
 * КОРІНЬ слота: обгортка з `display: contents` тут не годиться — `space-y-*`
 * добирає лише прямих дітей, і рядки підсумку втратили б відступи.
 */
export function CartSummary({ className }: CartSummaryProps) {
  const t = useT();
  const { quote, isError, refetch } = useCartQuote();
  const formatPrice = useFormatPrice();
  // Після збою квоти — прочерк і помилка з повтором, а не вічний скелет.
  const subtotal =
    quote !== null ? (
      formatPrice(quote.subtotal)
    ) : isError ? (
      '—'
    ) : (
      <PriceSkeleton />
    );

  return (
    <div
      data-simplycms-requisite={CART_REQUISITES.Summary}
      className={cn('space-y-4', className)}
    >
      {isError && <QuoteFailure onRetry={refetch} />}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          {t('cart.summary.itemsTotal')}
        </span>
        <span>{subtotal}</span>
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
        <span className="text-primary">{subtotal}</span>
      </div>
    </div>
  );
}
