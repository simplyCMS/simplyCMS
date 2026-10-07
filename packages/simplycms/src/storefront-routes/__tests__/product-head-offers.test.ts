import { describe, expect, it } from 'vitest';
import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import type { StorefrontRootData } from '../head/head';
import { productHead, type ProductHeadInput } from '../head/product';

/**
 * F9 фінального рев'ю К3-Е6в: `offers` JSON-LD — ГОСТЬОВА ціна (тип з
 * `loadGuestPriceTypes` + `resolvePrice`), а не «перша ціна без модифікації»
 * будь-якого типу. Знижки в JSON-LD не застосовуються (К3-Е6в-1).
 */
const PROFILE: StorefrontProfile = {
  name: 'Крамниця',
  homeTitle: null,
  description: null,
  contacts: { phone: null, email: null, address: null, hours: null },
  logoUrl: null,
  socials: [],
};
const matches = () => {
  const data: StorefrontRootData = {
    activeThemeName: 'default',
    storeProfile: PROFILE,
    siteUrl: '',
    locale: 'uk-UA',
  };
  return [{ routeId: '__root__', loaderData: data }];
};
const offersOf = (product: ProductHeadInput): unknown => {
  const head = productHead(matches(), product, 'solar');
  const ld = JSON.parse(head.scripts[0]!.children) as Record<string, unknown>;
  return ld.offers;
};

const entry = (
  price_type_id: string,
  price: number,
  modification_id: string | null = null,
) => ({ price_type_id, price, old_price: null, modification_id });

const BASE: ProductHeadInput = {
  name: 'Панель',
  slug: 'panel',
  description: null,
  images: [],
  stock_status: 'in_stock',
  has_modifications: false,
  product_modifications: [],
  // Гуртова ціна — ПЕРША: колишнє «перша ціна без модифікації» брало її.
  product_prices: [entry('wholesale', 800), entry('retail', 1000)],
  guest_price_types: { priceTypeId: 'retail', defaultPriceTypeId: 'retail' },
};

const mod = (
  id: string,
  stock_status: 'in_stock' | 'out_of_stock',
  is_default = false,
) => ({ id, is_default, sort_order: 0, stock_status });

describe('productHead: offers за гостьовою ціною (F9)', () => {
  it('гуртова ціна перша в списку → Offer з роздрібною (гостьовою)', () => {
    expect(offersOf(BASE)).toEqual({
      '@type': 'Offer',
      priceCurrency: 'UAH',
      price: 1000,
      availability: 'https://schema.org/InStock',
    });
  });

  it('тип гостя — гуртовий (дефолтна категорія) → ціна гуртова', () => {
    const guest = { priceTypeId: 'wholesale', defaultPriceTypeId: 'retail' };
    expect(offersOf({ ...BASE, guest_price_types: guest })).toMatchObject({
      price: 800,
    });
  });

  it('без гостьової ціни (лише чужий тип) → offers немає (не 0 і не інший тип)', () => {
    expect(
      offersOf({ ...BASE, product_prices: [entry('wholesale', 800)] }),
    ).toBeUndefined();
  });

  it('модифікації → AggregateOffer за гостьовими цінами доступних модифікацій', () => {
    const offers = offersOf({
      ...BASE,
      has_modifications: true,
      product_modifications: [
        mod('m1', 'in_stock', true),
        mod('m2', 'in_stock'),
        mod('m3', 'out_of_stock'),
      ],
      product_prices: [
        entry('wholesale', 100, 'm1'),
        entry('retail', 1200, 'm1'),
        entry('retail', 900, 'm2'),
        entry('retail', 50, 'm3'), // недоступна — у діапазон не йде
      ],
    });
    expect(offers).toEqual({
      '@type': 'AggregateOffer',
      priceCurrency: 'UAH',
      lowPrice: 900,
      highPrice: 1200,
      offerCount: 2,
      availability: 'https://schema.org/InStock',
    });
  });

  it('модифікації без гостьових цін → offers немає', () => {
    expect(
      offersOf({
        ...BASE,
        has_modifications: true,
        product_modifications: [mod('m1', 'in_stock', true)],
        product_prices: [entry('wholesale', 100, 'm1')],
      }),
    ).toBeUndefined();
  });
});
