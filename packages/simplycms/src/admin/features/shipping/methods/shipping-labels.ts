import {
  SHIPPING_PROVIDER,
  type ShippingPricing,
  type ShippingProviderId,
} from 'simplycms/contracts/shipping-providers';
import type { MessageKey } from 'simplycms/i18n';

export const PROVIDER_LABEL: Record<ShippingProviderId, MessageKey> = {
  [SHIPPING_PROVIDER.address]: 'admin.shipping.providers.address',
  [SHIPPING_PROVIDER.pickup]: 'admin.shipping.providers.pickup',
};

// Е6а-4: підпис `carrier` — спільний ключ із чекаутом.
export const PRICING_LABEL: Record<ShippingPricing, MessageKey> = {
  rates: 'admin.shipping.pricing.rates',
  provider: 'admin.shipping.pricing.provider',
  carrier: 'checkout.shipping.carrier',
};
