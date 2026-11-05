import type { LanguagePack } from '../types';

/** Англійська: повний каталог; таблиці адрес немає — латиниця йде як є. */
export const enPack: LanguagePack = {
  code: 'en',
  name: 'English',
  ui: {
    base: () => import('../catalogs/en/base').then((m) => m.messages),
    admin: () => import('../catalogs/en/admin/index').then((m) => m.messages),
    mail: () => import('../catalogs/en/mail').then((m) => m.messages),
  },
  content: {
    seed: {
      orderStatuses: {
        new: 'New',
        confirmed: 'Confirmed',
        processing: 'Processing',
        shipped: 'Shipped',
        delivered: 'Delivered',
        cancelled: 'Cancelled',
      },
      priceTypeRetail: 'Retail',
      customerCategoryRetail: 'Retail',
      mainShippingZone: 'Main zone',
      storeName: 'My store',
    },
  },
};
