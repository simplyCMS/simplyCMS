import type { NewOrderItem } from 'simplycms/commerce';

/** Контактні й доставкові дані оформлення. */
export interface NewOrderInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shippingMethodId: string;
  /**
   * Рев'ю M-2: код методу з `prepareCheckout` (уже провалідований на
   * `is_active`) — `createOrder` більше не робить власний `select` по
   * `shipping_methods` заради того самого фільтра.
   */
  shippingMethodCode: string | null;
  deliveryCity: string | null;
  deliveryAddress: string | null;
  pickupPointId: string | null;
  paymentMethod: string;
  notes: string | null;
  subtotal: number;
  shippingCost: number;
  total: number;
  hasDifferentRecipient: boolean;
  recipientFirstName: string | null;
  recipientLastName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  savedRecipientId: string | null;
  savedAddressId: string | null;
  items: NewOrderItem[];
}
