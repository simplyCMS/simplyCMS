import type { CatalogValue } from '../../types';

/** Кошик — дзеркало `uk/cart.ts`. */
export const messages = {
  'cart.title': 'Cart',
  'cart.itemsTitle': 'Items ({count})',
  // English has only 2 plural forms (one/other), as `Intl.PluralRules` says.
  'cart.items': { one: '{count} item', other: '{count} items' },
  'cart.clear': 'Clear cart',
  'cart.empty.title': 'Your cart is empty',
  'cart.empty.description':
    'Browse our catalog and add the products you are interested in',
  'cart.empty.hint': 'Add some products to place an order',
  'cart.empty.cta': 'Go to catalog',
  'cart.viewCart': 'View cart',
  'cart.itemSku': 'SKU: {sku}',
  'cart.unavailable': 'Product unavailable',
  'cart.removeItem': 'Remove from cart',
  'cart.quoteFailed': 'Could not get the price',
  'cart.quoteRetry': 'Retry',
  'cart.removeUnavailable': 'Remove unavailable items to place the order',
  'cart.limitReached':
    'Cart limit reached: up to {lines} items and {quantity} pcs of each',
  'cart.summary.title': 'Order summary',
  'cart.summary.itemsTotal': 'Items subtotal',
  'cart.summary.shipping': 'Shipping',
  'cart.summary.shippingHint': 'Calculated at checkout',
  'cart.summary.total': 'Total',
  'cart.summary.checkout': 'Place order',
} satisfies Record<string, CatalogValue>;
