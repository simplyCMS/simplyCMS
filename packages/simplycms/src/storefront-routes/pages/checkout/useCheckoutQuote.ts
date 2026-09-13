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
  /** Той самий предикат, що вже рахує `CheckoutDeliveryForm` для власного UI. */
  isPickup: boolean;
  /** У запит НЕ йде — лише тригерить перезапит при вході/виході з сесії. */
  userKey: string | null;
}

export interface CheckoutQuoteState {
  quote: QuoteCheckoutResult | null;
  quoting: boolean;
  /** Квота відповідає ПОТОЧНИМ входам — без цього submit неможливий (M-8). */
  matchesCurrent: boolean;
  /**
   * 🔴 Рев'ю I2/I3: сервер (`prepareCheckout`) відмовляє детерміновано, коли
   * метод/точку/місто ще не обрано — запит на квоту в цьому стані
   * ГАРАНТОВАНО падає (`shippingMethodId: z.string().uuid()` кидає на
   * порожньому рядку) або дає хибну ЧЕРВОНУ відмову на нормальному
   * проміжному стані заповнення форми. Клієнт передбачає це БЕЗ мережі —
   * тим самим предикатом, що вже стоїть у `prepareCheckout` — і взагалі не
   * питає. `true` — щось із трьох (метод / точка pickup / місто не-pickup)
   * ще не обрано; це НЕ помилка мережі, показ — нейтральний стан, не скелет
   * і не відмова.
   */
  blocked: boolean;
  /**
   * 🔴 Рев'ю I-2: відмова САМОГО ПРОМІСА (мережа, 500, кидок
   * `inputValidator`) — НЕ те саме, що `blocked` (детерміновано, без
   * мережі) і НЕ те саме, що серверна бізнес-відмова `quote.ok === false`
   * (та має `reason` і показується `REJECTION_KEY`). Причина тут клієнту
   * невідома, тому текст нейтральний. Без цього прапорця purposeful
   * `setQuoting(false)` у гілці відмови лишав `quotedKey`
   * недооновленим — `matchesCurrent` назавжди `false`, і
   * `CheckoutOrderSummary` малював вічний скелет без жодного повідомлення.
   * Скидається на `false`, щойно стартує НАСТУПНА спроба (зміна входів
   * запускає ефект наново, дебаунс — `QUOTE_DEBOUNCE_MS`) — стара відмова
   * не переживає нового запиту.
   */
  failed: boolean;
}

/**
 * Ключ входів, що РУХАЮТЬ ГРОШІ (розділ M) — зміна ключа = нова квота.
 * `isPickup` НЕ входить: він похідний від `shippingMethodId` (те саме
 * правило, що й у `CheckoutDeliveryForm`), тож окремої зміни ключа не додає.
 */
function moneyKey(p: Omit<CheckoutQuoteParams, 'isPickup'>): string {
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
