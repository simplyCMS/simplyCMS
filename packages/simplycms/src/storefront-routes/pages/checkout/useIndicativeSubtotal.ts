import type { QuoteCheckoutResult } from 'simplycms/contracts';
import { useCartQuote } from 'simplycms/core/hooks/useCartQuote';

export interface IndicativeSubtotal {
  /** Сума позицій; `null` — жодної квоти ще немає. */
  subtotal: number | null;
  /** Квота кошика впала, а квоти оформлення немає: помилка з повтором. */
  failed: boolean;
  retry: () => void;
}

/**
 * Сума позицій, від якої список способів доставки рахує тарифи ДО вибору
 * способу, і `cart.subtotal` контексту слотів чекауту (Е6в-13, ред.5).
 *
 * 🔴 Джерела — лише серверні квоти: після успішної квоти оформлення — її
 * `subtotal` (те саме число, що запише `prepareCheckout`), до неї — квота
 * кошика (те саме ядро цін). `null` — жодної квоти ще немає: тариф
 * показується станом завантаження, а не порахованим від 0 («безкоштовно від
 * 5000» на нульовому кошику збрехало б). Збій квоти кошика — `failed`:
 * видима помилка з повтором замість вічного скелета.
 */
export function useIndicativeSubtotal(
  checkoutQuote: QuoteCheckoutResult | null,
): IndicativeSubtotal {
  const { quote, isError, refetch } = useCartQuote();
  if (checkoutQuote?.ok)
    return {
      subtotal: checkoutQuote.quote.subtotal,
      failed: false,
      retry: refetch,
    };
  return { subtotal: quote?.subtotal ?? null, failed: isError, retry: refetch };
}
