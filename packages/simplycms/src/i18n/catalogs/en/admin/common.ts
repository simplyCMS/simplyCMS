import type { Catalog } from '../../../types';

/** Каркас адмінки — дзеркало `uk/admin/common.ts`. */
export const messages: Catalog = {
  'admin.common.title': 'Admin panel',
  'admin.common.toSite': 'View site',
  'admin.common.signedOut': 'Signed out',
  'admin.common.signedOutHint': 'You have been signed out',
  'admin.common.loading': 'Loading the admin panel…',

  'admin.common.placeholder.fallback': 'Page',
  'admin.common.placeholder.title': 'This page is under construction',
  'admin.common.placeholder.badge': 'In progress',
  'admin.common.placeholder.text':
    'This functionality will be available soon. In the meantime you can use the other sections of the CMS.',
  'admin.common.placeholder.orderStatuses': 'Order statuses',
  'admin.common.placeholder.serviceRequests': 'Service requests',

  'admin.common.revalidate.serverError': 'The server responded {status}',
  'admin.common.revalidate.delay': 'Changes will appear within 5 minutes.',
};
