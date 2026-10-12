import type { Catalog } from '../../../types';

/** Загальні налаштування — дзеркало `uk/admin/settings.ts`. */
export const messages: Catalog = {
  'admin.settings.subtitle': 'General system settings',
  'admin.settings.stock': 'Stock management',
  'admin.settings.stockHint': 'Automatic product stock accounting',
  'admin.settings.decreaseStock': 'Decrease stock when an order is placed',
  'admin.settings.decreaseStockHint':
    'When enabled, the system automatically decreases the stock quantity as a new order is created',
  'admin.settings.enabledCase':
    '• When enabled: as a customer places an order, stock is decreased by the ordered quantity automatically',
  'admin.settings.disabledCase':
    '• When disabled: stock is not changed automatically, an administrator manages it by hand',
  'admin.settings.warehouseNote':
    '• Stock is decreased at the warehouse specified in the order (pickup point), or at the first available one',
  // Store profile (E6b).
  'admin.settings.loadError': 'Failed to load settings',
  'admin.settings.profile.title': 'Profile and SEO',
  'admin.settings.profile.hint':
    'The name and description go into the tab title, meta tags and home page markup',
  'admin.settings.field.name': 'Store name',
  'admin.settings.field.homeTitle': 'Home page title',
  'admin.settings.field.homeTitleHint': 'Empty — the store name is used',
  'admin.settings.field.description': 'Default description',
  'admin.settings.contacts.title': 'Contacts',
  'admin.settings.field.phone': 'Phone',
  'admin.settings.field.email': 'Email',
  'admin.settings.field.address': 'Address',
  'admin.settings.field.hours': 'Opening hours',
  'admin.settings.logo.title': 'Logo',
  'admin.settings.logo.hint':
    'The file is replaced or erased when the profile is saved',
  'admin.settings.socials.title': 'Social networks',
  'admin.settings.socials.network': 'Network',
  'admin.settings.socials.url': 'Link',
  'admin.settings.socials.add': 'Add network',
  'admin.settings.socials.remove': 'Remove network',
  'admin.settings.socials.urlInvalid': 'The link must start with https://',
  'admin.settings.network.instagram': 'Instagram',
  'admin.settings.network.facebook': 'Facebook',
  'admin.settings.network.telegram': 'Telegram',
  'admin.settings.network.tiktok': 'TikTok',
  'admin.settings.network.youtube': 'YouTube',
  'admin.settings.network.x': 'X',
  'admin.settings.network.viber': 'Viber',
  // Файлове сховище: хвости стирання (Е6д-20).
  'admin.settings.storage.title': 'File storage',
  'admin.settings.storage.hint':
    'Files that could not be erased after their record was deleted. They are no longer shown on the site',
  'admin.settings.storage.count': 'Pending erasures: {count}',
  'admin.settings.storage.attempts': 'Attempts: {count}, last {date}',
  'admin.settings.storage.retry': 'Retry erasure',
  'admin.settings.storage.retried': 'Erased: {done}, failed: {failed}',
  'admin.settings.storage.loadError': 'Failed to load pending erasures',
  'admin.settings.storage.sweep': 'Remove unreferenced files',
  'admin.settings.storage.sweepTitle': 'Remove unreferenced files?',
  'admin.settings.storage.sweepText':
    'Files older than a day that are not used anywhere will be erased. This cannot be undone',
  'admin.settings.storage.swept': 'Files removed: {count}',
  // Пошта: хвости outbox (Е8-Р10).
  'admin.settings.mail.title': 'Mail',
  'admin.settings.mail.hint':
    'Emails that could not be sent. The body is not shown here — it may contain a sign-in link',
  'admin.settings.mail.empty': 'All emails were sent',
  'admin.settings.mail.count': 'Emails in the queue: {count}',
  'admin.settings.mail.attempts': 'Attempts: {count}, queued {age}',
  'admin.settings.mail.retry': 'Retry sending',
  'admin.settings.mail.retried': 'Sent: {sent}, failed: {failed}',
  'admin.settings.mail.loadError': 'Failed to load the email queue',
  'admin.settings.mail.ageMinutes': '{count} min',
  'admin.settings.mail.ageHours': '{count} h',
  'admin.settings.mail.ageDays': '{count} d',
  'admin.settings.mail.kind.password_reset': 'Password reset',
  'admin.settings.mail.kind.owner_invite': 'Owner invitation',
  'admin.settings.mail.kind.order_customer': 'Order email to the customer',
  'admin.settings.mail.kind.order_owner': 'Order email to the owner',
};
