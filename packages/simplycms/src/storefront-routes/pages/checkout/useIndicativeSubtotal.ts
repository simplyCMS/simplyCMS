import type { QuoteCheckoutResult } from 'simplycms/contracts';
import { useCartQuote } from 'simplycms/core/hooks/useCartQuote';

/**
 * Сума позицій, від якої список способів доставки рахує тарифи ДО вибору
 * способу, і `cart.subtotal` контексту слотів чекауту (Е6в-13, ред.5).
 *
 * 🔴 Джерела — лише серверні квоти: після успішної квоти оформлення — її
 * `subtotal` (те саме число, що запише `prepareCheckout`), до неї — квота
 * кошика (те саме ядро цін). `null` — жодної квоти ще немає: тариф
 * показується станом завантаження, а не порахованим від 0 («безкоштовно від
 * 5000» на нульовому кошику збрехало б).
 */
export function useIndicativeSubtotal(
  checkoutQuote: QuoteCheckoutResult | null,
): number | null {
  const { quote } = useCartQuote();
  if (checkoutQuote?.ok) return checkoutQuote.quote.subtotal;
  return quote?.subtotal ?? null;
}
