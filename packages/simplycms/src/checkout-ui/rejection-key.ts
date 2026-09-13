import type { PlaceOrderRejection } from 'simplycms/contracts';
import type { MessageKey } from 'simplycms/i18n';

/**
 * Код відмови сервера → ключ каталогу. Ділять КВОТА (`CheckoutOrderSummary`)
 * і оформлення (`Checkout.tsx`) — розділ M рішень архітектора: та сама
 * мапа, а не дві копії, які потім розійдуться текстом.
 */
export const REJECTION_KEY: Record<PlaceOrderRejection, MessageKey> = {
  shipping_unavailable: 'checkout.rejected.shipping_unavailable',
  pickup_point_invalid: 'checkout.rejected.pickup_point_invalid',
  not_purchasable: 'checkout.rejected.not_purchasable',
};
