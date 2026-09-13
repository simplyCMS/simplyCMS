import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CartItem } from 'simplycms/react-query';
import type { QuoteCheckoutResult } from 'simplycms/contracts';
import { quoteCheckout } from '../../server/checkout-quote';
import { buildQuoteInput } from './build-quote-input';

const QUOTE_DEBOUNCE_MS = 300;

// Стабільні посилання для `useSyncExternalStore` нижче — нове замикання на
// кожен рендер змусило б хук пере-підписуватись без жодної користі.
const subscribeNever = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Гідратація кошика — ТИМЧАСОВА локальна ідіома (рішення А архітектора,
 * той самий `useSyncExternalStore(subscribe, () => true, () => false)`),
 * яку Task 12 додасть у `useCart()` як прапорець `hydrated`. До того часу
 * перший клієнтський рендер кошика вже коректний (`useCart` сьогодні на
 * lazy-`useState`, не на `useSyncExternalStore`), тож гейт нижче нічого не
 * ламає СЬОГОДНІ — він лише готує місце під прапорець, щоб Task 12 замінив
 * цей виклик одним рядком (`useCart().hydrated`), а не переписував ефект.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    getClientSnapshot,
    getServerSnapshot,
  );
}

interface CheckoutQuoteParams {
  items: CartItem[];
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
  const hydrated = useHydrated();
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
