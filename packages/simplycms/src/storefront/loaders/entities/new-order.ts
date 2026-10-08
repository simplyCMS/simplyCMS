import type { NewOrderItem } from 'simplycms/commerce';
import type { NewShippingSnapshot } from 'simplycms/contracts/shipping-providers';

/** Контактні й доставкові дані оформлення. */
export interface NewOrderInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shippingMethodId: string;
  /** Знімок доставки з `prepareCheckout` (Е6а-8) — пишеться в `orders.shipping_data`. */
  shippingSnapshot: NewShippingSnapshot;
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
