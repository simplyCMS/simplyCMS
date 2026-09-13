import { useEffect, useRef, useState } from 'react';
import { useCart, type CartItem } from 'simplycms/react-query';
import type { QuoteCheckoutResult } from 'simplycms/contracts';
import { quoteCheckout } from '../../server/checkout-quote';
import { buildQuoteInput } from './build-quote-input';

const QUOTE_DEBOUNCE_MS = 300;

interface CheckoutQuoteParams {
  items: readonly CartItem[];
  shippingMethodId: string;
  pickupPointId: string;
  deliveryCity: string;
  /** У запит НЕ йде — лише тригерить перезапит при вході/виході з сесії. */
  userKey: string | null;
}

export interface CheckoutQuoteState {
  quote: QuoteCheckoutResult | null;
  quoting: boolean;
  /** Квота відповідає ПОТОЧНИМ входам — без цього submit неможливий (M-8). */
  matchesCurrent: boolean;
}

/** Ключ входів, що РУХАЮТЬ ГРОШІ (розділ M) — зміна ключа = нова квота. */
function moneyKey(p: CheckoutQuoteParams): string {
  return JSON.stringify([
    p.items.map((i) => [i.productId, i.modificationId, i.quantity]),
    p.shippingMethodId,
    p.pickupPointId,
    p.deliveryCity,
    p.userKey,
  ]);
}

/**
 * Серверна квота чекауту (розділ M рішень архітектора): і квота, і
 * оформлення рахують `prepareCheckout`, тож «показане = записане» тримається
 * ЗА ПОБУДОВОЮ. Дебаунс — щоб набір символів у місті не бив запитами на
 * кожен keystroke; гейт на `hydrated` — щоб перша квота не пішла з
 * порожнім кошиком до того, як кошик прочитав `localStorage` (Task 12).
 */
export function useCheckoutQuote({
  items,
  shippingMethodId,
  pickupPointId,
  deliveryCity,
  userKey,
}: CheckoutQuoteParams): CheckoutQuoteState {
  // Ознака гідратації — ОДНА на застосунок (Task 12, рішення А): та сама, за
  // якою гейтяться редирект і рендер-гілка порожнього кошика в Checkout.tsx.
  // Локальний `useSyncExternalStore` тут БУВ тимчасовим містком (Task 11) —
  // друга незалежна ознака гідратації в одному застосунку є саме тим класом
  // дефекту, з яким воює весь етап.
  const { hydrated } = useCart();
  const [quote, setQuote] = useState<QuoteCheckoutResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quotedKey, setQuotedKey] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const key = moneyKey({
    items,
    shippingMethodId,
    pickupPointId,
    deliveryCity,
    userKey,
  });

  useEffect(() => {
    if (!hydrated || items.length === 0) return;

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      setQuoting(true);
      const data = buildQuoteInput({
        items,
        shippingMethodId,
        pickupPointId,
        deliveryCity,
      });
      void quoteCheckout({ data }).then(
        (result) => {
          if (requestIdRef.current !== requestId) return;
          setQuote(result);
          setQuotedKey(key);
          setQuoting(false);
        },
        () => {
          if (requestIdRef.current !== requestId) return;
          setQuoting(false);
        },
      );
    }, QUOTE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [hydrated, items, shippingMethodId, pickupPointId, deliveryCity, key]);

  return { quote, quoting, matchesCurrent: quotedKey === key };
}
