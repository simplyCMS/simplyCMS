import type { SitemapData } from '../loaders/sitemap';
import { indexPolicy } from './index-policy';

/**
 * Рендер `/sitemap.xml` — ЧИСТА функція від даних (В2-К1а).
 *
 * 🔴 Раніше тут же жив і похід у базу (клієнт БД параметром), і саме це
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

  /**
   * Товари: рядок на опубліковану мову, де `indexPolicy` каже «індексується»; його
   * альтернативи — ті самі hreflang, що вийдуть у `<head>` сторінки (паритет).
   * Неперекладена версія `noindex` і поза sitemap.
   */
  for (const product of data.products) {
    for (const version of product.languages) {
      const policy = indexPolicy({
        locale: version.code,
        primary: product.primary,
        isTranslated: version.isTranslated,
        languages: product.languages,
      });
      if (!policy.indexable) continue;
      urls.push(
        entry(
          `${baseUrl}${policy.canonical}`,
          product.updated_at,
          'weekly',
          0.7,
          policy.hreflang.map((h) => ({
            hrefLang: h.hrefLang,
            href: `${baseUrl}${h.href}`,
          })),
        ),
      );
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`;
}

function entry(
  loc: string,
  lastmod?: Date,
  changefreq?: string,
  priority?: number,
  alternates: ReadonlyArray<{ hrefLang: string; href: string }> = [],
): string {
  const parts = [`  <url>\n    <loc>${escapeXml(loc)}</loc>`];
  // Єдине місце, де дата стає рядком: W3C Datetime для sitemaps.org; текст
  // драйвера (`2026-07-01 00:00:00+00`) роботи відкидають.
  if (lastmod) parts.push(`    <lastmod>${lastmod.toISOString()}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority !== undefined)
    parts.push(`    <priority>${priority}</priority>`);
  for (const alt of alternates) {
    parts.push(
      `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hrefLang)}" href="${escapeXml(alt.href)}"/>`,
    );
  }
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
