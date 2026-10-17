import { describe, expect, it } from 'vitest';
import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import { renderSitemapXml } from 'simplycms/storefront/seo';
import { indexPolicy } from 'simplycms/storefront/seo';
import type { SitemapData } from 'simplycms/storefront/loaders';
import { productHead, type ProductHeadInput } from '../head/product';

/**
 * Паритет sitemap ↔ сторінка (М1, І33): кожен URL sitemap є self-canonical сторінки
 * і стоїть у її hreflang, а alternates sitemap збігаються з `<link rel="alternate">`,
 * які `head()` тієї ж сторінки віддає. Обидва боки беруть `indexPolicy`, але тест
 * звіряє КІНЦЕВІ документи, тож обхід політики в sitemap (чи в head) його валить.
 */
const BASE = 'https://shop.test';
const PROFILE: StorefrontProfile = {
  name: 'Крамниця',
  homeTitle: null,
  description: null,
  contacts: { phone: null, email: null, address: null, hours: null },
  logoUrl: null,
  socials: [],
};
const DATA: SitemapData = {
  sections: [],
  products: [
    {
      updated_at: new Date('2026-07-02T00:00:00Z'),
      primary: 'uk',
      languages: [
        { code: 'uk', isTranslated: true, path: 'cherevyky' },
        { code: 'en', isTranslated: true, path: 'boots' },
        { code: 'pl', isTranslated: false, path: 'cherevyky' },
      ],
    },
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

const entries = (xml: string) =>
  [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
    loc: /<loc>([^<]*)<\/loc>/.exec(m[1]!)![1]!,
    alternates: [
      ...m[1]!.matchAll(
        /<xhtml:link rel="alternate" hreflang="([^"]*)" href="([^"]*)"\/>/g,
      ),
    ].map((a) => ({ rel: 'alternate', hrefLang: a[1]!, href: a[2]! })),
  }));

function headOf(
  p: SitemapData['products'][number],
  locale: string,
  isTranslated: boolean,
) {
  const input = {
    name: 'Товар',
    description: null,
    images: [],
    stock_status: 'in_stock',
    has_modifications: false,
    product_modifications: [],
    product_prices: [],
    guest_price_types: { priceTypeId: null, defaultPriceTypeId: null },
    page: {
      locale,
      seo: indexPolicy({
        locale,
        primary: p.primary,
        isTranslated,
        languages: p.languages,
      }),
    },
  } as unknown as ProductHeadInput;
  return productHead(
    [
      {
        routeId: '__root__',
        loaderData: {
          activeThemeName: 'default',
          storeProfile: PROFILE,
          siteUrl: BASE,
          locale,
          languages: { primary: p.primary, published: ['uk', 'en', 'pl'] },
        },
      },
    ],
    input,
  );
}

describe('паритет sitemap і head() сторінки товару', () => {
  const xml = renderSitemapXml(DATA, BASE);

  it('URL sitemap = canonical сторінки; alternates = hreflang її head; неіндексовані версії поза sitemap', () => {
    const inSitemap = entries(xml);
    for (const p of DATA.products) {
      for (const v of p.languages) {
        const head = headOf(p, v.code, v.isTranslated);
        const canonical = head.links.find((l) => l.rel === 'canonical')!.href;
        const own = `${BASE}${v.code === p.primary ? '' : `/${v.code}`}/${v.path}`;
        const entry = inSitemap.find((e) => e.loc === own);
        if (canonical !== own || v.isTranslated === false) {
          // Версія не self-canonical (неперекладена → canonical на основну) — у sitemap її немає.
          expect(entry, own).toBeUndefined();
          continue;
        }
        expect(entry, own).toBeDefined();
        const alternates = head.links
          .filter((l) => l.rel === 'alternate')
          .map((l) => ({
            rel: 'alternate',
            hrefLang: l.hrefLang!,
            href: l.href,
          }));
        expect(entry!.alternates).toEqual(alternates);
        if (alternates.length > 0)
          expect(alternates.map((a) => a.href)).toContain(own);
      }
    }
  });
});
