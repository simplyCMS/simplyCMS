import type { Catalog } from '../types';

/**
 * Англійський каталог — частковий за контрактом (`Catalog = Partial<…>`):
 * відсутній ключ віддає українське повідомлення, а не порожній рядок.
 */
export const messages: Catalog = {
  'nav.profile': 'Profile',
  'nav.orders': 'My orders',
  'nav.settings': 'Settings',
  'nav.signOut': 'Sign out',

  'breadcrumbs.home': 'Home',

  'cart.title': 'Cart',
  'cart.items': 'Items ({count})',
  'cart.clear': 'Clear cart',
  'cart.empty.title': 'Your cart is empty',
  'cart.empty.description':
    'Browse our catalog and add the products you are interested in',
  'cart.empty.cta': 'Go to catalog',
  'cart.summary.title': 'Order summary',
  'cart.summary.itemsTotal': 'Items subtotal',
  'cart.summary.shipping': 'Shipping',
  'cart.summary.shippingHint': 'Calculated at checkout',
  'cart.summary.total': 'Total',
  'cart.summary.checkout': 'Place order',

  'auth.setPassword.title': 'Set your password',
  'auth.setPassword.description':
    'You have accepted the invitation. Choose a password to sign in to the store.',
  'auth.setPassword.password': 'Password',
  'auth.setPassword.confirm': 'Repeat password',
  'auth.setPassword.submit': 'Save and continue',
  'auth.setPassword.mismatch': 'Passwords do not match',
  'auth.setPassword.tooShort': 'At least 8 characters',
  'auth.setPassword.noSession':
    'The link is invalid or has expired. Ask for a new invitation.',
  'auth.setPassword.backToAuth': 'Go to sign in',
  'auth.setPassword.error': 'Could not save the password. Please try again.',
};
