import type { Catalog } from '../../../types';

/** DB conflicts (Е3-7) — mirror of `uk/admin/errors.ts`. */
export const messages: Catalog = {
  'admin.errors.slugTaken': 'This URL (slug) is already taken — change it',
  'admin.errors.conflictUnique': 'This value already exists',
  'admin.errors.conflictReference':
    'The record is in use (e.g. in orders) — deactivate it instead of deleting',
  'admin.errors.network':
    'No connection to the server — changes were not saved',
};
