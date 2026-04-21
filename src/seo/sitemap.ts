import { createAnonSupabaseClient } from '@simplycms/core/supabase/anon';

const BASE_URL =
  import.meta.env.VITE_SITE_URL || 'https://example.com';

/** Генерує sitemap.xml з активних секцій і товарів */
export async function buildSitemapXml(): Promise<string> {
  const supabase = createAnonSupabaseClient();

  const [sectionsRes, productsRes] = await Promise.all([
    supabase
      .from('sections')
      .select('slug, updated_at')
      .order('sort_order'),
    supabase
      .from('products')
      .select('slug, updated_at, sections(slug)')
      .eq('is_active', true),
  ]);

  const urls: string[] = [];

  /** Статичні сторінки */
  urls.push(entry(BASE_URL, undefined, 'daily', 1));
  urls.push(entry(`${BASE_URL}/catalog`, undefined, 'daily', 0.9));
  urls.push(entry(`${BASE_URL}/properties`, undefined, 'weekly', 0.5));

  /** Секції */
  for (const s of sectionsRes.data ?? []) {
    urls.push(
      entry(
        `${BASE_URL}/catalog/${s.slug}`,
        s.updated_at ?? undefined,
        'daily',
        0.8,
      ),
    );
  }

  /** Товари */
  for (const p of productsRes.data ?? []) {
    const sectionSlug =
      (p.sections as { slug: string } | null)?.slug ?? 'products';
    urls.push(
      entry(
        `${BASE_URL}/catalog/${sectionSlug}/${p.slug}`,
        p.updated_at ?? undefined,
        'weekly',
        0.7,
      ),
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

function entry(
  loc: string,
  lastmod?: string,
  changefreq?: string,
  priority?: number,
): string {
  const parts = [`  <url>\n    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority !== undefined)
    parts.push(`    <priority>${priority}</priority>`);
  parts.push('  </url>');
  return parts.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
