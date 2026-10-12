import type { Catalog } from '../../types';

/** Листи ядра — дзеркало `uk/mail.ts`. */
export const messages: Catalog = {
  'mail.reset.subject': 'Password reset — {storeName}',
  'mail.reset.intro':
    'You (or someone else) asked to reset the password for the store "{storeName}".',
  'mail.reset.openLink': 'To set a new password, open this link:',
  'mail.reset.action': 'Set a new password',
  'mail.reset.ignore':
    'If you did not ask for this, just ignore this email — your password stays the same.',
  'mail.invite.subject': 'Owner invitation — {storeName}',
  'mail.invite.intro':
    'You have been invited as the owner of the store "{storeName}".',
  'mail.invite.openLink': 'To set a password and sign in, open this link:',
  'mail.invite.action': 'Set a password and sign in',
  'mail.invite.ttl': 'The link is single-use and valid for {hours} h.',
  'mail.invite.ignore': 'If you were not expecting this email, just ignore it.',
  'mail.order.customer.subject': 'Order #{orderNumber} received — {storeName}',
  'mail.order.customer.intro':
    'Thank you for your order at "{storeName}". Your order number is {orderNumber}.',
  'mail.order.line': '{name} × {quantity} — {total}',
  'mail.order.subtotal': 'Items: {amount}',
  'mail.order.shipping': 'Shipping: {amount}',
  'mail.order.total': 'Total: {amount}',
  'mail.order.owner.subject': 'New order #{orderNumber} — {storeName}',
  'mail.order.owner.intro':
    'A new order #{orderNumber} was placed at "{storeName}".',
  'mail.order.owner.customer': 'Customer: {name}, {phone}, {email}',
  'mail.order.owner.noEmail': 'no email provided',
  'mail.order.owner.delivery': 'Delivery: {address}',
  'mail.order.owner.openLink':
    'To open the order in the admin panel, follow the link:',
  'mail.order.owner.action': 'Open the order',
};
