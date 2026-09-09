import type { Catalog } from '../../types';

/** Кошик — дзеркало `uk/cart.ts`. */
export const messages: Catalog = {
  'cart.title': 'Cart',
  'cart.items': 'Items ({count})',
  // English has only 2 plural forms; "few"/"many" collapse onto the same word.
  'cart.itemsOne': 'item',
  'cart.itemsFew': 'items',
  'cart.itemsMany': 'items',
  'cart.clear': 'Clear cart',
  'cart.empty.title': 'Your cart is empty',
  'cart.empty.description':
    'Browse our catalog and add the products you are interested in',
  'cart.empty.hint': 'Add some products to place an order',
  'cart.empty.cta': 'Go to catalog',
  'cart.viewCart': 'View cart',
  'cart.itemSku': 'SKU: {sku}',
  'cart.summary.title': 'Order summary',
  'cart.summary.itemsTotal': 'Items subtotal',
  'cart.summary.shipping': 'Shipping',
  'cart.summary.shippingHint': 'Calculated at checkout',
  'cart.summary.total': 'Total',
  'cart.summary.checkout': 'Place order',
};
