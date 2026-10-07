// Фінальне рев'ю К3-Е6в, F9: `offers` Product JSON-LD сторінки товару —
// ГОСТЬОВА ціна наскрізь: лоадер сторінки (`loadProduct`) віддає типи ціни
// гостя (`loadGuestPriceTypes`), `productHead` рахує `resolvePrice` — і ціна
// дорівнює тій, що гість бачить після гідрації (квота кошика). Знижки в
// JSON-LD не йдуть (К3-Е6в-1).
import { describe, expect, it } from 'vitest';
import type { StorefrontProfile } from 'simplycms/contracts/store-profile';
import {
  loadProduct,
  quoteCartFor,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';
import { productHead } from 'simplycms/storefront-routes/head/product';
import * as F from './fixtures/commerce';
import { line, useCommerceDb } from './fixtures/commerce-db';

const WHOLESALE_TYPE = 'c0000002-0000-4000-8000-000000000001';
const DEFAULT_CATEGORY = '00000004-0000-4000-8000-000000000001';
const PROFILE: StorefrontProfile = {
  name: 'Крамниця',
  homeTitle: null,
  description: null,
  contacts: { phone: null, email: null, address: null, hours: null },
  logoUrl: null,
  socials: [],
};
const matches = [
  {
    routeId: '__root__',
    loaderData: {
      activeThemeName: 'default',
      storeProfile: PROFILE,
      siteUrl: '',
      locale: 'uk-UA',
    },
  },
];

describe('JSON-LD offers сторінки товару — гостьова ціна (F9)', () => {
  const db = useCommerceDb('simplycms_product_jsonld_offers');

  const offersOf = async (slug: string) => {
    const product = await withStorefrontDb((tx) => loadProduct(tx, slug));
    if (!product) throw new Error(`товару ${slug} немає`);
    const head = productHead(matches, product, 'any');
    const ld = JSON.parse(head.scripts[0]!.children) as Record<string, unknown>;
    return ld.offers as Record<string, unknown> | undefined;
  };
  const guestBase = async (productId: string) => {
    const first = (await quoteCartFor([line(productId)], null)).lines[0];
    if (!first.available) throw new Error('недоступний');
    return first.basePrice;
  };

  it('ціна offers = гостьова ціна клієнта; дефолтна категорія з гуртовим типом → гуртова', async () => {
    const slug = 'stantsiya-nakopychennya-10kwh';
    expect((await offersOf(slug))?.price).toBe(
      await guestBase(F.STATION_10KWH),
    );
    await db.run(
      `update public.user_categories set price_type_id = '${WHOLESALE_TYPE}' where id = '${DEFAULT_CATEGORY}'`,
    );
    try {
      expect(await offersOf(slug)).toMatchObject({
        '@type': 'Offer',
        price: F.WHOLESALE_STATION_PRICE,
      });
      expect(await guestBase(F.STATION_10KWH)).toBe(F.WHOLESALE_STATION_PRICE);
    } finally {
      await db.run(
        `update public.user_categories set price_type_id = (select id from public.price_types where code = 'retail') where id = '${DEFAULT_CATEGORY}'`,
      );
    }
  });

  it('товар лише з ціною чужого типу → offers немає', async () => {
    await db.run(
      `delete from public.product_prices where product_id = '${F.BATTERY_200AH}'`,
    );
    await db.run(
      `insert into public.product_prices (id, price_type_id, product_id, modification_id, price)
       values (gen_random_uuid(), '${WHOLESALE_TYPE}', '${F.BATTERY_200AH}', null, 777)`,
    );
    expect(await offersOf('akumulyator-lifepo4-200ah')).toBeUndefined();
  });
});
