// Framework-agnostic адаптери магазину (LinkResolver + ConfigProvider).
//
// 🔴 V2: медіа-провайдер на Supabase Storage звідси знесений разом із шаром
// репозиторіїв — storage-порт повертає трек К3/К6. Лишились два ЧИСТИХ
// (без IO) провайдери, тож модуль безпечний для браузерного бандла.

import type { LinkResolver, ConfigProvider } from 'simplycms/contracts';
import config from '../simplycms.config';

/** Маршрути simplyCMS-вітрини. */
export const appLinks: LinkResolver = {
  product: (p) =>
    p.sectionSlug
      ? `/catalog/${p.sectionSlug}/${p.slug}`
      : `/catalog/${p.slug}`,
  section: (s) => `/catalog/${s.slug}`,
  cart: () => '/cart',
  checkout: () => '/checkout',
  profile: (sub) => (sub ? `/profile/${sub}` : '/profile'),
  auth: () => '/auth',
  admin: (sub) => (sub ? `/admin/${sub}` : '/admin'),
};

/** Конфіг вітрини — проєкція `simplycms.config.ts` на контракт ConfigProvider. */
export const appConfig: ConfigProvider = {
  locale: config.locale,
  currency: config.currency,
  siteUrl: config.seo.siteUrl,
  seo: {
    defaultTitle: config.seo.defaultTitle,
    titleTemplate: config.seo.titleTemplate,
    defaultDescription: config.seo.defaultDescription,
  },
};
