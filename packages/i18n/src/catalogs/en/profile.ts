import type { Catalog } from '../../types';

/** Особистий кабінет — дзеркало `uk/profile.ts`. */
export const messages: Catalog = {
  'profile.title': 'My profile',
  'profile.personalData': 'Personal details',
  'profile.recentOrders': 'Recent orders',
  'profile.allOrders': 'All orders',
  'profile.noOrders': 'You have no orders yet',

  'profile.orders.title': 'My orders',
  'profile.orders.allStatuses': 'All statuses',
  'profile.orders.noneForStatus': 'No orders with this status',
  'profile.orders.emptyHint': 'Browse our catalog and place your first order',
  'profile.orders.filterHint': 'Try a different filter',
  'profile.orders.moreItems': 'and {count} more',

  'profile.order.notFound': 'Order not found',
  'profile.order.notFoundHint':
    'It may have been deleted, or you may not have access to it',
  'profile.order.items': 'Order items',
  'profile.order.shippingMethod': 'Shipping method',
  'profile.order.paymentMethod': 'Payment method',
  'profile.order.customer': 'Customer',
  'profile.order.comment': 'Order comment',

  'profile.order.cancel.statusMissing': 'The "Cancelled" status was not found',
  'profile.order.cancel.notAuthorized': 'You are not signed in',
  'profile.order.cancel.confirmTitle': 'Cancel this order?',
  'profile.order.cancel.confirmText':
    'Are you sure you want to cancel order {number}? This cannot be undone.',
  'profile.order.cancel.keep': 'No, keep it',
  'profile.order.cancel.confirm': 'Yes, cancel',
  'profile.order.cancel.pending': 'Cancelling...',
  'profile.order.cancel.done': 'Order cancelled',
  'profile.order.cancel.doneHint': 'Order {number} has been cancelled',
  'profile.order.cancel.failed': 'Could not cancel the order',

  'profile.settings.avatar': 'Profile photo',
  'profile.settings.editContacts': 'Edit your contact details',
  'profile.settings.firstNamePlaceholder': 'Enter your first name',
  'profile.settings.lastNamePlaceholder': 'Enter your last name',
  'profile.settings.emailLocked': 'Email cannot be changed',
  'profile.settings.saved': 'Saved',
  'profile.settings.savedHint': 'Your details have been updated',
  'profile.settings.saveFailed': 'Could not save your details',

  'profile.password.title': 'Change password',
  'profile.password.subtitle': 'Set a new password for your account',
  'profile.password.new': 'New password',
  'profile.password.confirm': 'Confirm password',
  'profile.password.confirmPlaceholder': 'Repeat the new password',
  'profile.password.submit': 'Change password',
  'profile.password.pending': 'Changing...',
  'profile.password.changed': 'Password changed',
  'profile.password.changedHint': 'Your password has been updated',
  'profile.password.failed': 'Could not change the password',
};
