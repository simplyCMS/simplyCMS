import { Link } from '@tanstack/react-router';
import type { CartQuote } from 'simplycms/contracts';
import { useT } from 'simplycms/i18n';
import { useFormatPrice } from 'simplycms/react-query';
import { PriceSkeleton } from './CartLinePrice';
import { CheckoutAction } from './CheckoutAction';
import { QuoteFailure } from './QuoteFailure';

export interface CartDrawerFooterProps {
  quote: CartQuote | null;
  failed: boolean;
  onRetry: () => void;
  /** У кошику є недоступна позиція — оформлення заблоковано. */
  blocked: boolean;
  onClose: () => void;
}

/**
 * Підсумок drawer'а: сума з квоти (скелет до неї, прочерк і помилка з
 * повтором після збою) і переходи до кошика й оформлення.
 */
export function CartDrawerFooter({
  quote,
  failed,
  onRetry,
  blocked,
  onClose,
}: CartDrawerFooterProps) {
  const t = useT();
  const formatPrice = useFormatPrice();
  const subtotal =
    quote !== null ? (
      formatPrice(quote.subtotal)
    ) : failed ? (
      '—'
    ) : (
      <PriceSkeleton />
    );

  return (
    <div className="mt-auto p-6 border-t">
      {failed && <QuoteFailure onRetry={onRetry} className="mb-3" />}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('common.amount')}</span>
          <span>{subtotal}</span>
        </div>
        <div className="flex justify-between font-medium text-lg">
          <span>{t('cart.summary.total')}</span>
          <span className="text-primary">{subtotal}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          to="/cart"
          onClick={onClose}
          className="flex-1 text-center px-4 py-2 border rounded-md text-sm"
        >
          {t('cart.viewCart')}
        </Link>
        <CheckoutAction blocked={blocked} onNavigate={onClose} />
      </div>
      {blocked && (
        <p className="mt-2 text-xs text-destructive">
          {t('cart.removeUnavailable')}
        </p>
      )}
    </div>
  );
}
