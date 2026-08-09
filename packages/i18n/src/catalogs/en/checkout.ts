import type { Catalog } from '../../types';

/** Оформлення замовлення — дзеркало `uk/checkout.ts`. */
export const messages: Catalog = {
  'checkout.title': 'Checkout',

  'checkout.emptyCart': 'Your cart is empty',
  'checkout.emptyCartHint': 'Add products to the cart before checking out',
  'checkout.placed': 'Order placed!',
  'checkout.placedNumber': 'Order number: {number}',
  'checkout.failed': 'Could not place the order',
  'checkout.retry': 'Please try again',

  'checkout.shipping.pickup': 'Pickup',
  'checkout.shipping.novaPoshta': 'Nova Poshta',
  'checkout.shipping.courier': 'Courier',
  'checkout.payment.cash': 'Cash on delivery',
  'checkout.payment.online': 'Online payment',

  'checkout.success.title': 'Order placed',
  'checkout.success.thanks': 'Thank you for your order!',
  'checkout.success.sentTo': 'We have sent a confirmation to',
  'checkout.success.orderNumber': 'Order number',
  'checkout.success.copied': 'Copied',
  'checkout.success.copiedHint': 'Order number copied to clipboard',
  'checkout.success.notFound': 'Order not found',
  'checkout.success.notFoundHint':
    'The link may be invalid or the access period has expired',
  'checkout.success.toHome': 'Go to home page',
  'checkout.success.details': 'Order details',
  'checkout.success.recipient': 'Recipient',
  'checkout.success.payment': 'Payment',
};
