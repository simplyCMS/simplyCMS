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

  // Shipping addresses — CRUD widget (simplycms/profile-ui, AddressesList)
  'profile.addresses.title': 'Shipping addresses',
  'profile.addresses.empty': "You haven't added any addresses yet",
  'profile.addresses.deleted': 'Address deleted',
  'profile.addresses.editTitle': 'Edit address',
  'profile.addresses.namePlaceholder': 'Home, Work...',
  'profile.addresses.cityPlaceholder': 'Kyiv',
  'profile.addresses.addressPlaceholder': '1 Khreshchatyk St, Apt 1',
  'profile.addresses.deleteTitle': 'Delete address "{name}"?',
  'profile.addresses.deleteUsedOne': 'This address is used in {count} order.',
  'profile.addresses.deleteUsedMany': 'This address is used in {count} orders.',
  'profile.addresses.deleteKeepsData':
    'Address details on past orders will be kept.',
  'profile.addresses.deleteConfirm':
    'Are you sure you want to delete this address?',

  // Recipients — CRUD widget (simplycms/profile-ui, RecipientsList)
  'profile.recipients.title': 'Recipients',
  'profile.recipients.empty': "You haven't added any recipients yet",
  'profile.recipients.deleted': 'Recipient deleted',
  'profile.recipients.defaultBadge': 'Default',
  'profile.recipients.editTitle': 'Edit recipient',
  'profile.recipients.emailOptionalLabel': 'Email (optional)',
  'profile.recipients.notesLabel': 'Notes',
  'profile.recipients.notesPlaceholder': 'E.g. Mom, coworker...',
  'profile.recipients.defaultCheckboxLabel': 'Default recipient',
  'profile.recipients.deleteTitle': 'Delete recipient "{fullName}"?',
  'profile.recipients.deleteUsedOne': 'This contact is used in {count} order.',
  'profile.recipients.deleteUsedMany':
    'This contact is used in {count} orders.',
  'profile.recipients.deleteKeepsData':
    'Recipient details on past orders will be kept.',
  'profile.recipients.deleteConfirm':
    'Are you sure you want to delete this recipient?',

  // "Used in N orders" badge — shared by addresses and recipients.
  'profile.usedInOrders.one': 'Used in {count} order',
  'profile.usedInOrders.many': 'Used in {count} orders',

  // Profile photo (simplycms/profile-ui, AvatarUpload)
  'profile.avatar.uploadError': 'Upload failed',
  'profile.avatar.unsupportedFormat': 'Only JPG, PNG, and WebP are supported',
  'profile.avatar.tooLarge': 'File size must be under 5MB',
  'profile.avatar.updated': 'Avatar updated',
  'profile.avatar.removed': 'Avatar removed',
  'profile.avatar.deleteError': 'Delete failed',
  'profile.avatar.uploadButton': 'Upload photo',
  'profile.avatar.formatHint': 'JPG, PNG, or WebP. Max 5MB.',
};
