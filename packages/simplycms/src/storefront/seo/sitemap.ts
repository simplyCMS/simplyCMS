import type { SitemapData } from '../loaders/sitemap';

/**
 * Рендер `/sitemap.xml` — ЧИСТА функція від даних (В2-К1а).
 *
 * 🔴 Раніше тут же жив і похід у базу (Supabase-клієнт параметром), і саме це
 * робило юніт-тест тестом мока PostgREST, а не тестом sitemap. Після переходу
 * на Drizzle предикат видимості перевіряється SQL-ом на живій БД
 * (`loadSitemapData` + гейт `pnpm test:schema`), а тут лишається рівно те, що
 * можна довести без БД: форма XML, екранування й склад URL-ів.
 */
export function renderSitemapXml(data: SitemapData, baseUrl: string): string {
  const urls: string[] = [];

  /** Статичні сторінки */
  urls.push(entry(baseUrl, undefined, 'daily', 1));
  urls.push(entry(`${baseUrl}/catalog`, undefined, 'daily', 0.9));
  urls.push(entry(`${baseUrl}/properties`, undefined, 'weekly', 0.5));

  /** Секції */
  for (const section of data.sections) {
    urls.push(
      entry(
        `${baseUrl}/catalog/${section.slug}`,
        section.updated_at,
        'daily',
        0.8,
      ),
    );
  }

  /** Товари */
  for (const product of data.products) {
    const sectionSlug = product.section_slug ?? 'products';
    urls.push(
      entry(
        `${baseUrl}/catalog/${sectionSlug}/${product.slug}`,
        product.updated_at,
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
