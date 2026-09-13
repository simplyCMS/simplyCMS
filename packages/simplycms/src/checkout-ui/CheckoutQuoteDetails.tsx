import { useEngine, useFormatPrice } from 'simplycms/react-query';
import { formatShippingCost } from 'simplycms/domain/shipping';
import type { CheckoutQuote } from 'simplycms/contracts';
import { useT } from 'simplycms/i18n';

interface CheckoutQuoteDetailsProps {
  quote: CheckoutQuote;
}

/**
 * Рядки, суми й «до сплати» — з КВОТИ сервера (розділ M рішень архітектора):
 * винесено з `CheckoutOrderSummary` окремим файлом лише заради канону 150
 * рядків, це не самостійна відповідальність.
 */
export function CheckoutQuoteDetails({ quote }: CheckoutQuoteDetailsProps) {
  const t = useT();
  const formatPrice = useFormatPrice();
  // Локаль і валюта для `formatShippingCost` — це чиста T1-функція, вона не
  // має доступу ні до конфігу, ні до перекладів (див. коментар у shipping.ts).
  const { config } = useEngine();

  return (
    <>
      <div className="space-y-3">
        {quote.items.map((item, index) => (
          <div
            key={`${item.productId}-${item.modificationId}-${index}`}
            className="flex justify-between text-sm"
          >
            <div className="flex-1">
              <div className="font-medium line-clamp-1">{item.name}</div>
              <div className="text-muted-foreground">
                {item.quantity} &times; {formatPrice(item.price)}
              </div>
            </div>
            <div className="font-medium ml-4">
              {formatPrice(item.price * item.quantity)}
            </div>
          </div>
        ))}
      </div>

      <hr />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {t('checkout.orderSummary.itemsCount', {
              count: quote.items.length,
            })}
          </span>
          <span>{formatPrice(quote.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {t('cart.summary.shipping')}
          </span>
          <span>
            {formatShippingCost(quote.shippingCost, config, {
              byTariff: t('common.shipping.byTariff'),
              free: t('common.shipping.free'),
            })}
          </span>
        </div>
      </div>

      <hr />

      <div className="flex justify-between font-semibold text-lg">
        <span>{t('common.total')}</span>
        {/* Id — для live-smoke (Task 14): читає число і звіряє з `orders`. */}
        <span id="checkout-total" className="text-primary">
          {formatPrice(quote.total)}
        </span>
      </div>
    </>
  );
}
