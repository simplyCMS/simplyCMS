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
};
