import type { Catalog } from '../../../types';

/** Види цін — дзеркало `uk/admin/prices.ts`. */
export const messages: Catalog = {
  'admin.prices.subtitle': 'Manage product price types',
  'admin.prices.add': 'Add a price type',
  'admin.prices.empty': 'No price types yet',
  'admin.prices.created': 'Price type created',
  'admin.prices.deleted': 'Price type deleted',
  'admin.prices.new': 'New price type',
  'admin.prices.editTitle': 'Edit price type',
  'admin.prices.deleteTitle': 'Delete this price type?',
  'admin.prices.deleteWarning':
    'A price type referenced by product prices cannot be deleted: remove those prices first. Deleting only removes an empty type.',
  'admin.prices.namePlaceholder': 'Retail',
  'admin.prices.codeHint': 'Unique code (Latin letters, digits, _)',
  'admin.prices.defaultHint': 'This price type will be used as the fallback',
  'admin.prices.defaultLocked': 'The default price type cannot be deleted',
  'admin.prices.codeFormat': 'Latin letters, digits and _ only',
  'admin.prices.defaultKeep':
    'To change the default, make another type the default',
  'admin.prices.notFound': 'Price type not found',
};
