import type { CartItem } from 'simplycms/react-query';
import type { QuoteCheckoutResult } from 'simplycms/contracts';

/**
 * Форми стану й ключ свіжості серверної квоти чекауту (розділ M).
 *
 * 🔴 Живуть окремо від хука рівно з тієї ж причини, що `cart-store.ts` від
 * `useCart.tsx`: контракт стану (що саме означає кожен прапорець) читають
 * ТРИ споживачі — сам хук, `CheckoutOrderSummary` і його тести, — а канон
 * репо тримає файл у 150 рядках. Розділ за відповідальністю: тут — ЩО таке
 * стан квоти, у хуку — КОЛИ він змінюється.
 */

export const QUOTE_DEBOUNCE_MS = 300;

export interface CheckoutQuoteParams {
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
export function moneyKey(p: Omit<CheckoutQuoteParams, 'isPickup'>): string {
  return JSON.stringify([
    p.items.map((i) => [i.productId, i.modificationId, i.quantity]),
    p.shippingMethodId,
    p.pickupPointId,
    p.deliveryCity,
    p.userKey,
  ]);
}
