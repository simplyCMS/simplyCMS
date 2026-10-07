import type { Catalog } from '../../../types';

/** Валідатор цін — дзеркало `uk/admin/validator.ts`. */
export const messages: Catalog = {
  'admin.validator.subtitle':
    'Shows the price a customer gets, which discounts applied and why others did not',
  'admin.validator.params': 'Check parameters',
  'admin.validator.customer': 'Customer',
  'admin.validator.guest': 'Guest',
  'admin.validator.guestHint': 'Not signed in: default category and price type',
  'admin.validator.customerSearch': 'Search a customer by email or name',
  'admin.validator.customerEmpty': 'No customer found',
  'admin.validator.customerFailed': 'Could not search for customers',
  'admin.validator.noEmail': 'no email',
  'admin.validator.product': 'Product',
  'admin.validator.productChange': 'Change product',
  'admin.validator.quantity': 'Quantity',
  'admin.validator.cartTotal': 'Rest of the cart total (UAH)',
  'admin.validator.run': 'Check',
  'admin.validator.failed': 'The check failed',
  'admin.validator.result': 'Analysis result',
  'admin.validator.priceType': 'Price type',
  'admin.validator.category': 'Customer category',
  'admin.validator.notDefined': 'Not defined',
  'admin.validator.unavailable':
    'The item cannot be bought: product disabled, no price or no stock',
  'admin.validator.basePrice': 'Base price',
  'admin.validator.finalPrice': 'Final price',
  'admin.validator.applied': 'Applied',
  'admin.validator.rejected': 'Rejected',
  'admin.validator.noneApplied': 'No discount applied',
  'admin.validator.noneRejected': 'No rejected discounts',
  'admin.validator.discountLine': '{name} ({group}): −{amount}',
  'admin.validator.rejectedLine': '{name} ({group})',
  'admin.validator.conditionType': 'condition "{type}"',
  'admin.validator.reason.inactive': 'The discount is turned off',
  'admin.validator.reason.out_of_dates': 'Outside the discount dates',
  'admin.validator.reason.group_inactive': 'The discount group is turned off',
  'admin.validator.reason.group_out_of_dates':
    'Outside the discount group dates',
  'admin.validator.reason.target_mismatch':
    'The discount does not cover this product or section',
  'admin.validator.reason.condition_failed':
    'The discount condition is not met',
  'admin.validator.reason.condition_unknown':
    'Condition type is not registered (the condition plugin is not installed)',
  'admin.validator.reason.condition_invalid':
    'Condition data is corrupted: open the discount and save it again',
  'admin.validator.reason.discount_invalid':
    'The discount row is corrupted and excluded from the calculation',
  'admin.validator.reason.lost_to_operator':
    'Lost to another discount under the group operator',
  'admin.validator.reason.exceeds_price':
    'Did not fit: discounts already brought the price to zero',
};
