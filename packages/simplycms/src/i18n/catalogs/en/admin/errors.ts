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
  'admin.errors.storeLogoInvalid':
    'The logo must be uploaded through the profile form — choose the file again',
  'admin.errors.themeNotBuilt':
    'This theme is not in the store build — add its package and rebuild the store',
  'admin.errors.themeUnknown': 'Theme not found — reload the page',
  'admin.errors.pluginUnknown': 'Plugin not found — reload the page',
  'admin.errors.discountGroupCycle':
    'A group cannot be nested inside its own subgroup',
  'admin.errors.discountGroupDatesInvalid':
    'The start date must be earlier than the end date',
  'admin.errors.discountConditionCategoryMissing':
    'A customer category in the discount condition no longer exists — reload the page and choose the category again',
  'admin.errors.userCategoryDefault':
    'The default category cannot be deleted — make another category the default first',
  'admin.errors.userCategoryHasCustomers':
    'The category has customers — move them to another category',
  'admin.errors.userCategoryHasRules':
    'Automatic rules use this category — change or delete them first',
  'admin.errors.userCategoryInDiscount':
    'A discount condition uses this category — remove it from the condition first',
  'admin.errors.categoryRuleSameCategory':
    'A rule cannot move a customer into the same category',
  'admin.errors.adminRoleSelf':
    'You cannot remove the admin role from yourself',
  'admin.errors.adminRoleLast':
    'This is the last administrator — the role cannot be removed',
  'admin.errors.adminRoleBanned': 'Unblock the customer first',
  'admin.errors.customerIsAdmin': 'Remove the administrator role first',
  'admin.errors.customerNotFound': 'Customer not found',
  'admin.errors.customerSelf': 'You cannot delete your own account',
  'admin.errors.orderPersonalDataErased':
    'The customer was deleted — order items can no longer be changed',
  'admin.errors.network':
    'No connection to the server — changes were not saved',
};
