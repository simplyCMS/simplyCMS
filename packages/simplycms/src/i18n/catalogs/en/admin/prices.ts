import type { Catalog } from '../../../types';

/** Види цін — дзеркало `uk/admin/prices.ts`. */
export const messages: Catalog = {
  'admin.prices.subtitle': 'Manage product price types',
  'admin.prices.add': 'Add a price type',
  'admin.prices.empty': 'No price types yet',
  'admin.prices.created': 'Price type created',
  'admin.prices.deleted': 'Price type deleted',
  'admin.prices.confirmDelete': 'Delete this price type?',
  'admin.prices.new': 'New price type',
  'admin.prices.editTitle': 'Edit price type',
  'admin.prices.deleteTitle': 'Delete this price type?',
  'admin.prices.deleteWarning':
    'This cannot be undone. All prices of this type will be deleted.',
  'admin.prices.namePlaceholder': 'Retail',
  'admin.prices.codeHint': 'Unique code (Latin letters, digits, _)',
  'admin.prices.defaultHint': 'This price type will be used as the fallback',
};
