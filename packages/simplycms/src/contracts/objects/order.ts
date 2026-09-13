// Доменні об'єкти замовлень.

import type { PageQuery } from './common';

export interface OrderItem {
  productId: string;
  modificationId: string | null;
  name: string;
  quantity: number;
  price: number;
}

export interface OrderCustomer {
  name: string;
  email: string | null;
  phone: string;
}

export interface Order {
  id: string;
  number: string;
  status: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  total: number;
  shipping: {
    methodId: string;
    rateId: string | null;
    pickupPointId: string | null;
    city: string | null;
    address: string | null;
  } | null;
  comment: string | null;
  userId: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateOrderInput {
  customer: OrderCustomer;
  items: OrderItem[];
  shipping?: Order['shipping'];
  shippingCost?: number;
  paymentMethod?: string;
  comment?: string | null;
  userId?: string | null;
}

/** Позиція запиту оформлення — ЛИШЕ ідентичність і кількість (К2-Е0, Е0-4). */
export interface CheckoutItemInput {
  productId: string;
  modificationId: string | null;
  quantity: number;
}

/**
 * Запит оформлення замовлення — канонічний ТИП (T0). Zod-схема живе в T5
 * (`storefront-routes/server/checkout-input.ts`) і оголошує
 * `satisfies z.ZodType<PlaceOrderInput>`: одна форма для валідатора,
 * сторінки й сервера. Цін і вартості доставки тут немає — їх рахує сервер.
 */
export interface PlaceOrderInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shippingMethodId: string;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  pickupPointId: string | null;
  paymentMethod: 'cash' | 'online';
  notes: string | null;
  hasDifferentRecipient: boolean;
  recipientFirstName: string | null;
  recipientLastName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  recipientCity: string | null;
  recipientAddress: string | null;
  recipientNotes: string | null;
  /** Зберегти нового отримувача в книгу покупця. */
  saveRecipient: boolean;
  /** Обраний зі списку отримувач; `null` — новий або без отримувача. */
  savedRecipientId: string | null;
  savedAddressId: string | null;
  items: CheckoutItemInput[];
}

/** Доменні відмови оформлення — КОДОМ; текст — у каталозі повідомлень. */
export type PlaceOrderRejection =
  'shipping_unavailable' | 'pickup_point_invalid' | 'not_purchasable';

/** Що повертається після успішного оформлення. */
export interface PlacedOrder {
  id: string;
  orderNumber: string;
  /** Токен гостьового замовлення; для залогіненого — `null`. */
  accessToken: string | null;
}

export type PlaceOrderResult =
  { ok: true; order: PlacedOrder } | { ok: false; reason: PlaceOrderRejection };

export interface OrderQuery extends PageQuery {
  status?: string;
  userId?: string;
  search?: string;
}
