import { createAnonSupabaseClient } from '@simplycms/core/supabase/anon';
import { buildSitemapXml as buildSitemap } from '@simplycms/storefront/seo';

const BASE_URL = import.meta.env.VITE_SITE_URL || 'https://example.com';

/** Генерує sitemap.xml (host-glue: anon-клієнт + VITE_SITE_URL). */
export function buildSitemapXml(): Promise<string> {
  return buildSitemap(createAnonSupabaseClient(), BASE_URL);
}
