import type { Catalog } from '../../../types';

/** Валідатор цін — дзеркало `uk/admin/validator.ts`. */
export const messages: Catalog = {
  'admin.validator.subtitle':
    'Check the pricing chain for a specific user and product',
  'admin.validator.params': 'Check parameters',
  'admin.validator.guestOption': 'Guest (not signed in)',
  'admin.validator.guest': 'Guest',
  'admin.validator.noEmail': 'no email',
  'admin.validator.noModification': 'No modification',
  'admin.validator.cartTotal': 'Cart total (UAH)',
  'admin.validator.run': 'Check',
  'admin.validator.result': 'Analysis result',
  'admin.validator.applied': 'Applied',
  'admin.validator.rejected': 'Rejected',
  'admin.validator.categoryStep':
    'Category "{category}" → Price type "{priceType}"',
  'admin.validator.noCategoryStep':
    'User without a category → Default "{priceType}"',
  'admin.validator.guestStep': 'Guest → Default "{priceType}"',
  'admin.validator.undefined': 'Not determined',
  'admin.validator.noPriceType': 'No price type found',
  'admin.validator.notFound': 'Not found',
  'admin.validator.noPriceForType': 'No price for this price type',
  'admin.validator.none': 'None',
  'admin.validator.noDiscountForType': 'No discount found for this price type',
  'admin.validator.finalPrice': 'Final price',
  'admin.validator.noDiscount': 'Without discount: {price} UAH',
  'admin.validator.discountSum': '-{value} UAH',
  'admin.validator.appliedCount': '{count} discounts applied',
  'admin.validator.noneApplies': 'No discount applies',
  'admin.validator.uah': '{value} UAH',
  'admin.validator.fixedUah': '= {value} UAH',
};
