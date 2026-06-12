import { createAnonSupabaseClient } from '@simplysoftua/core/supabase/anon';
import { buildSitemapXml as buildSitemap } from '@simplysoftua/storefront/seo';

const BASE_URL = import.meta.env.VITE_SITE_URL || 'https://example.com';

/** Генерує sitemap.xml (host-glue: anon-клієнт + VITE_SITE_URL). */
export function buildSitemapXml(): Promise<string> {
  return buildSitemap(createAnonSupabaseClient(), BASE_URL);
}
