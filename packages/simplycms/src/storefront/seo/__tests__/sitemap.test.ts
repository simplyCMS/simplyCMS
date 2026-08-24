import { describe, expect, it } from 'vitest';
import { renderSitemapXml } from '../sitemap';
import type { SitemapData } from '../../loaders/sitemap';

/**
 * Юніт рендера sitemap — БЕЗ бази й без мока клієнта.
 *
 * 🔴 Мок-клієнт Supabase, що стояв тут доти, доводив лише те, що ланцюг
 * `.from().select()` викликано в очікуваному порядку — тобто перевіряв макет
 * PostgREST. Фільтр видимості й помилки запиту тепер доводяться на живій БД
 * (`test-harness/pg/__tests__/storefront-loaders.test.ts`), а тут лишилось
 * рівно те, що від бази не залежить.
 */

const DATA: SitemapData = {
  sections: [{ slug: 'shoes', updated_at: '2026-07-01T00:00:00Z' }],
  products: [
    {
      slug: 'boot',
      updated_at: '2026-07-02T00:00:00Z',
      section_slug: 'shoes',
    },
    { slug: 'orphan', updated_at: '2026-07-03T00:00:00Z', section_slug: null },
  ],
};

describe('renderSitemapXml', () => {
  const xml = renderSitemapXml(DATA, 'https://shop.test');

  it('статичні сторінки, розділи й товари — у одному urlset', () => {
    expect(xml).toContain('<loc>https://shop.test</loc>');
    expect(xml).toContain('<loc>https://shop.test/catalog</loc>');
    expect(xml).toContain('<loc>https://shop.test/properties</loc>');
    expect(xml).toContain('<loc>https://shop.test/catalog/shoes</loc>');
    expect(xml).toContain('<loc>https://shop.test/catalog/shoes/boot</loc>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('товар без розділу отримує технічний префікс, а не порожній сегмент', () => {
    // `/catalog//orphan` був би 404-ю з подвійним слешем — саме той випадок,
    // який робот запамʼятовує надовго.
    expect(xml).toContain(
      '<loc>https://shop.test/catalog/products/orphan</loc>',
    );
    expect(xml).not.toContain('/catalog//');
  });

  it('lastmod береться з рядка БД', () => {
    expect(xml).toContain('<lastmod>2026-07-01T00:00:00Z</lastmod>');
    expect(xml).toContain('<lastmod>2026-07-02T00:00:00Z</lastmod>');
  });

  it('спецсимволи в slug екрануються', () => {
    const escaped = renderSitemapXml(
      {
        sections: [],
        products: [
          {
            slug: 'a&b',
            updated_at: '2026-07-02T00:00:00Z',
            section_slug: 'x<y',
          },
        ],
      },
      'https://shop.test',
    );

    expect(escaped).toContain(
      '<loc>https://shop.test/catalog/x&lt;y/a&amp;b</loc>',
    );
  });

  it('порожня база → валідний XML лише зі статичних сторінок', () => {
    const empty = renderSitemapXml(
      { sections: [], products: [] },
      'https://shop.test',
    );

    expect(empty.match(/<url>/g)).toHaveLength(3);
  });
});
