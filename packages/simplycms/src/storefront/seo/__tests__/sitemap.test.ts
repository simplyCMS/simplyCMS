import { describe, expect, it } from 'vitest';
import { renderSitemapXml } from '../sitemap';
import { indexPolicy } from '../index-policy';
import type { SitemapData } from '../../loaders/sitemap';

/**
 * Юніт рендера sitemap — БЕЗ бази й без мока клієнта.
 *
 * 🔴 Мок-клієнт БД, що стояв тут доти, доводив лише те, що ланцюг
 * `.from().select()` викликано в очікуваному порядку — тобто перевіряв макет
 * PostgREST. Фільтр видимості й помилки запиту тепер доводяться на живій БД
 * (`test-harness/pg/__tests__/storefront-loaders.test.ts`), а тут лишилось
 * рівно те, що від бази не залежить.
 */

const DATA: SitemapData = {
  sections: [{ slug: 'shoes', updated_at: new Date('2026-07-01T00:00:00Z') }],
  products: [
    // Перекладено англійською: дві версії з взаємними alternates.
    {
      updated_at: new Date('2026-07-02T00:00:00Z'),
      primary: 'uk',
      languages: [
        { code: 'uk', isTranslated: true, path: 'cherevyky' },
        { code: 'en', isTranslated: true, path: 'boots' },
      ],
    },
    // Англійська без повного перекладу: лише основна версія, без alternates.
    {
      updated_at: new Date('2026-07-03T00:00:00Z'),
      primary: 'uk',
      languages: [
        { code: 'uk', isTranslated: true, path: 'kurtka' },
        { code: 'en', isTranslated: false, path: 'kurtka' },
      ],
    },
  ],
};

/** `<url>`-блоки з sitemap: loc + alternates. */
function urlEntries(xml: string) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
    loc: /<loc>([^<]*)<\/loc>/.exec(m[1]!)?.[1],
    alternates: [
      ...m[1]!.matchAll(
        /<xhtml:link rel="alternate" hreflang="([^"]*)" href="([^"]*)"\/>/g,
      ),
    ].map((a) => ({ hrefLang: a[1], href: a[2] })),
  }));
}

describe('renderSitemapXml', () => {
  const xml = renderSitemapXml(DATA, 'https://shop.test');

  it('статичні сторінки, розділи й товари — у одному urlset', () => {
    expect(xml).toContain('<loc>https://shop.test</loc>');
    expect(xml).toContain('<loc>https://shop.test/catalog</loc>');
    expect(xml).toContain('<loc>https://shop.test/properties</loc>');
    expect(xml).toContain('<loc>https://shop.test/catalog/shoes</loc>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it('товар із перекладом en — дві <url> з взаємними alternates і x-default', () => {
    const entries = urlEntries(xml);
    const uk = entries.find((e) => e.loc === 'https://shop.test/cherevyky');
    const en = entries.find((e) => e.loc === 'https://shop.test/en/boots');
    const alternates = [
      { hrefLang: 'uk', href: 'https://shop.test/cherevyky' },
      { hrefLang: 'en', href: 'https://shop.test/en/boots' },
      { hrefLang: 'x-default', href: 'https://shop.test/cherevyky' },
    ];
    expect(uk?.alternates).toEqual(alternates);
    expect(en?.alternates).toEqual(alternates);
  });

  it('товар без перекладу — лише основна версія, без alternates і без неперекладеної', () => {
    const entries = urlEntries(xml);
    expect(entries.find((e) => e.loc === 'https://shop.test/kurtka')).toEqual({
      loc: 'https://shop.test/kurtka',
      alternates: [],
    });
    expect(xml).not.toContain('/en/kurtka');
  });

  it('паритет: кожен товарний URL = self-canonical своєї версії й є в її alternates', () => {
    for (const product of DATA.products) {
      for (const v of product.languages) {
        const policy = indexPolicy({
          locale: v.code,
          primary: product.primary,
          isTranslated: v.isTranslated,
          languages: product.languages,
        });
        const own = `https://shop.test${
          v.code === product.primary ? '' : `/${v.code.toLowerCase()}`
        }/${v.path}`;
        const entry = urlEntries(xml).find((e) => e.loc === own);
        // Версія в sitemap ТОДІ Й ЛИШЕ ТОДІ, коли політика каже «індексується».
        expect(entry !== undefined).toBe(policy.indexable);
        if (!entry) continue;
        expect(`https://shop.test${policy.canonical}`).toBe(own);
        if (entry.alternates.length > 0) {
          expect(entry.alternates.map((a) => a.href)).toContain(own);
        }
      }
    }
  });

  it('lastmod — W3C Datetime (toISOString), а не текст драйвера', () => {
    // 🔴 sitemaps.org вимагає W3C Datetime; текст Postgres
    // (`2026-07-01 00:00:00+00`) роботи відкидають. Межа виводу — єдине
    // місце, де Date стає рядком.
    expect(xml).toContain('<lastmod>2026-07-01T00:00:00.000Z</lastmod>');
    expect(xml).toContain('<lastmod>2026-07-02T00:00:00.000Z</lastmod>');
    for (const m of xml.matchAll(/<lastmod>([^<]*)<\/lastmod>/g)) {
      expect(m[1]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });

  it('спецсимволи екрануються', () => {
    const escaped = renderSitemapXml(
      {
        sections: [
          { slug: 'x<y', updated_at: new Date('2026-07-01T00:00:00Z') },
        ],
        products: [],
      },
      'https://shop.test',
    );

    expect(escaped).toContain('<loc>https://shop.test/catalog/x&lt;y</loc>');
  });

  it('порожня база → валідний XML лише зі статичних сторінок', () => {
    const empty = renderSitemapXml(
      { sections: [], products: [] },
      'https://shop.test',
    );

    expect(empty.match(/<url>/g)).toHaveLength(3);
  });
});
