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
  'admin.errors.network':
    'No connection to the server — changes were not saved',
};
