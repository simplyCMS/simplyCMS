import { createServerFn } from '@tanstack/react-start';
import { createServerSupabase } from './supabase';

const BASE_URL = import.meta.env.VITE_SITE_URL || 'https://example.com';

if (!import.meta.env.VITE_SITE_URL) {
  console.warn(
    '[sitemap] VITE_SITE_URL не задано — використовується https://example.com',
  );
}

/** Дані для генерації sitemap.xml */
export const getSitemapData = createServerFn({ method: 'GET' })
  .handler(async () => {
    const supabase = createServerSupabase();

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

    const staticPages = [
      { url: BASE_URL, changeFrequency: 'daily' as const, priority: 1 },
      {
        url: `${BASE_URL}/catalog`,
        changeFrequency: 'daily' as const,
        priority: 0.9,
      },
      {
        url: `${BASE_URL}/properties`,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      },
    ];

    const sectionPages = (sectionsRes.data ?? []).map((section) => ({
      url: `${BASE_URL}/catalog/${section.slug}`,
      lastModified: section.updated_at ?? new Date().toISOString(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }));

    const productPages = (productsRes.data ?? []).map((product) => {
      const sectionSlug =
        (product.sections as { slug: string } | null)?.slug ?? 'products';
      return {
        url: `${BASE_URL}/catalog/${sectionSlug}/${product.slug}`,
        lastModified: product.updated_at ?? new Date().toISOString(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      };
    });

    return { staticPages, sectionPages, productPages };
  });

/** Дані для robots.txt */
export const getRobotsData = createServerFn({ method: 'GET' })
  .handler(async () => {
    return {
      rules: [
        {
          userAgent: '*',
          allow: '/',
          disallow: ['/admin/', '/api/', '/auth/callback'],
        },
      ],
      sitemap: `${BASE_URL}/sitemap.xml`,
    };
  });
