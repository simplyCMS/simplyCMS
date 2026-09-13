import type { CartItem } from 'simplycms/react-query';
import type { CheckoutItemInput, PlaceOrderInput } from 'simplycms/contracts';

/** Кошик → позиції запиту: лише ідентичність і кількість (Е0-4, К2-Е0). */
export function toCheckoutItems(
  items: readonly CartItem[],
): CheckoutItemInput[] {
  return items
    .filter((item) => item.productId)
    .map((item) => ({
      productId: item.productId,
      modificationId: item.modificationId,
      quantity: item.quantity,
    }));
}

export interface QuoteMoneyInput {
  items: readonly CartItem[];
  shippingMethodId: string;
  pickupPointId: string;
  deliveryCity: string;
}

/**
 * Мінімальний вхід КВОТИ — та сама Zod-схема, що й оформлення (розділ M
 * рішень архітектора): `prepareCheckout` контактних полів не читає, але
 * спільна схема вимагає їх непорожніми (`firstName`/`lastName` — `min(2)`).
 * Значення нижче — заглушки: покупець міг ще не ввести імʼя, а квота вже
 * показується на зміну кошика чи доставки. Жоден із цих рядків нікуди не
 * записується і не показується — квота їх узагалі не читає.
 */
export function buildQuoteInput(input: QuoteMoneyInput): PlaceOrderInput {
  return {
    firstName: 'quote',
    lastName: 'quote',
    email: '',
    phone: '',
    shippingMethodId: input.shippingMethodId,
    deliveryCity: input.deliveryCity || null,
    deliveryAddress: null,
    pickupPointId: input.pickupPointId || null,
    paymentMethod: 'cash',
    notes: null,
    hasDifferentRecipient: false,
    recipientFirstName: null,
    recipientLastName: null,
    recipientPhone: null,
    recipientEmail: null,
    recipientCity: null,
    recipientAddress: null,
    recipientNotes: null,
    saveRecipient: false,
    savedRecipientId: null,
    savedAddressId: null,
    items: toCheckoutItems(input.items),
  };
}
