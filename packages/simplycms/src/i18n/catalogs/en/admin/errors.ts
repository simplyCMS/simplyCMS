import type { Catalog } from '../../../types';

/** DB conflicts (Е3-7) — mirror of `uk/admin/errors.ts`. */
export const messages: Catalog = {
  'admin.errors.slugTaken': 'This URL (slug) is already taken — change it',
  'admin.errors.conflictUnique': 'This value already exists',
  'admin.errors.conflictReference':
    'The record is in use (e.g. in orders) — deactivate it instead of deleting',
  'admin.errors.orderCancelledFinal': 'A cancelled order cannot be changed',
  'admin.errors.orderShippingUnavailable':
    'Shipping by this method is unavailable for the new order contents — change not saved',
  'admin.errors.orderInsufficientStock': 'Not enough stock — change not saved',
  'admin.errors.orderLastItem':
    'The last item cannot be removed — an order cannot be empty',
  'admin.errors.orderItemNotPurchasable':
    'This product cannot be ordered right now',
  'admin.errors.orderAmountOutOfRange':
    'The order amount exceeds the allowed limit — change not saved',
  'admin.errors.shippingPricingUnsupported':
    'This provider cannot quote shipping itself — choose another pricing mode',
  'admin.errors.shippingProviderUnknown': 'Unknown shipping provider',
  'admin.errors.shippingZoneDefault':
    'The default zone cannot be disabled or deleted — make another zone the default first',
  'admin.errors.shippingZoneInactive': 'Only an active zone can be the default',
  'admin.errors.pickupPointMethodInvalid':
    'A pickup point can only belong to a pickup shipping method',
  'admin.errors.pickupPointSystem':
    'The system pickup point (warehouse) cannot be deleted',
  'admin.errors.pickupPointHasStock':
    'The point holds stock or order reservations — deactivate it instead of deleting',
  'admin.errors.network':
    'No connection to the server — changes were not saved',
};
