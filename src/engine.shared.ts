// Framework-agnostic адаптери магазину (LinkResolver/ConfigProvider/MediaProvider).
// Спільні для серверної (engine.ts) і клієнтської (engine.client.tsx) збірок —
// без імпорту createServerSupabase, тож безпечні для браузерного бандла.

import type {
  LinkResolver,
  MediaProvider,
  ConfigProvider,
  ImageOpts,
} from '@simplycms/objects';
import type { SupabaseClient } from '@supabase/supabase-js';
import config from '../simplycms.config';

/**
 * Типи БД ЦЬОГО магазину: core-схема + таблиці встановлених плагінів.
 * Джерело — генерат `pnpm db:generate-types` (`supabase/types.ts`).
 *
 * Пакети ядра типізуються проти baseline у `@simplycms/supabase`; host звужує
 * клієнти до своїх типів, підставляючи `StoreDatabase` у generic-параметр
 * фабрик (`createServerSupabase<StoreDatabase>()`, `useSupabaseClient<…>()`).
 * Тип-онлі реекспорт — у бандл не потрапляє.
 */
export type { Database as StoreDatabase } from '../supabase/types';

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

/** Медіа через Supabase Storage. */
export function createAppMediaProvider(
  client: SupabaseClient,
  bucket = 'media',
): MediaProvider {
  return {
    url(path: string, opts?: ImageOpts): string {
      if (/^https?:\/\//.test(path)) return path;
      const { data } = client.storage.from(bucket).getPublicUrl(path);
      const base = data.publicUrl;
      if (!opts) return base;
      const params = new URLSearchParams();
      if (opts.width) params.set('width', String(opts.width));
      if (opts.height) params.set('height', String(opts.height));
      if (opts.quality) params.set('quality', String(opts.quality));
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
    async upload(file: File): Promise<string> {
      const path = `${Date.now()}-${file.name}`;
      const { error } = await client.storage.from(bucket).upload(path, file);
      if (error) throw new Error(`[media.upload] ${error.message}`);
      return path;
    },
  };
}

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
