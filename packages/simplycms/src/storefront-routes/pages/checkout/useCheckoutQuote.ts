import { useEffect, useRef, useState } from 'react';
import type { QuoteCheckoutResult } from 'simplycms/contracts';
import { useCart } from 'simplycms/react-query';
import { quoteCheckout } from '../../server/checkout-quote';
import { buildQuoteInput } from './build-quote-input';
import {
  moneyKey,
  QUOTE_DEBOUNCE_MS,
  type CheckoutQuoteParams,
  type CheckoutQuoteState,
} from './quote-state';

export type { CheckoutQuoteState } from './quote-state';

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
  isPickup,
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
  const [failed, setFailed] = useState(false);
  const requestIdRef = useRef(0);
  const key = moneyKey({
    items,
    shippingMethodId,
    pickupPointId,
    deliveryCity,
    userKey,
  });
  // Дзеркало ДВОХ гвардів `prepareCheckout` (`!method` і `!isPickup &&
  // !city` / `isPickup && !point`) — без мережі, тим самим предикатом.
  const blocked =
    shippingMethodId === '' ||
    (isPickup ? pickupPointId === '' : deliveryCity === '');

  useEffect(() => {
    if (!hydrated || items.length === 0 || blocked) return;

    const requestId = ++requestIdRef.current;
    const timer = setTimeout(() => {
      // Нова спроба стартує — попередня відмова (I-2) більше не описує
      // поточний стан входів. Скидається ТУТ, а не синхронно в тілі
      // ефекту (react-hooks/set-state-in-effect: setState напряму в тілі
      // ефекту, поза колбеком, — окремий клас застороги лінту): до
      // спрацювання таймера рендер ще встигає показати старий текст
      // відмови, далі його заступить скелет на час самого запиту.
      setFailed(false);
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
          setFailed(true);
        },
      );
    }, QUOTE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [
    hydrated,
    items,
    blocked,
    shippingMethodId,
    pickupPointId,
    deliveryCity,
    key,
  ]);

  return {
    quote,
    quoting,
    matchesCurrent: quotedKey === key,
    blocked,
    failed,
  };
}
