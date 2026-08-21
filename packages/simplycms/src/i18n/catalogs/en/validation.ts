import type { Catalog } from '../../types';

/** Повідомлення валідації форм — дзеркало `uk/validation.ts`. */
export const messages: Catalog = {
  'validation.nameRequired': 'Name is required',
  'validation.codeRequired': 'Code is required',
  'validation.cityRequired': 'City is required',
  'validation.addressRequired': 'Address is required',

  'validation.min2': 'At least 2 characters',
  'validation.min6': 'At least 6 characters',
  'validation.max20': 'At most 20 characters',
  'validation.max100': 'At most 100 characters',
  'validation.positive': 'The value must be positive',

  'validation.email': 'Enter a valid email',
  'validation.emailFormat': 'Invalid email format',
  'validation.phone': 'Enter a valid phone number',
  'validation.slug': 'Latin letters, digits and _ only',

  'validation.firstNameMin2': 'First name must be at least 2 characters',
  'validation.lastNameMin2': 'Last name must be at least 2 characters',
  'validation.passwordMin6': 'Password must be at least 6 characters',
  'validation.passwordMismatch': 'Passwords do not match',

  'validation.shippingRequired': 'Choose a shipping method',
  'validation.paymentRequired': 'Choose a payment method',
  'validation.contactRequired': 'Provide an email or a phone number',
  'validation.recipientRequired': 'Fill in all required recipient fields',
  'validation.groupRequired': 'Choose a group',
  'validation.priceTypeRequired': 'Choose a price type',
  'validation.targetCategoryRequired': 'Choose a target category',
};
