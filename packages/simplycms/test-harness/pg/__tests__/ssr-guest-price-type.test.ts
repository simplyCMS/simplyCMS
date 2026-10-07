// Фінальне рев'ю К3-Е6в, F5b: SSR-ціна гостя — за ТИМ САМИМ резолвером типу
// ціни, що `loadPricingContext` (тип дефолтної категорії, інакше глобальний
// дефолтний). SSR лишається гостьовим (К3-Е6в-1), але база в серверному HTML
// не має розходитися з ціною, яку гість побачить після гідрації.
import { beforeAll, describe, expect, it } from 'vitest';
import {
  discountEnvironmentFor,
  loadHomePageData,
  quoteCartFor,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';
import { loadProductListPayload } from 'simplycms/storefront-routes/server/product-list-payload';
import * as F from './fixtures/commerce';
import { line, useCommerceDb } from './fixtures/commerce-db';

const PRODUCT = F.STATION_10KWH;
const WHOLESALE_TYPE = 'c0000002-0000-4000-8000-000000000001';
const DEFAULT_CATEGORY = '00000004-0000-4000-8000-000000000001';

describe('SSR-ціна гостя = клієнтська ціна гостя (F5b)', () => {
  const db = useCommerceDb('simplycms_ssr_guest_price_type');
  let clientPrice = 0;

  beforeAll(async () => {
    // Дефолтна категорія — з гуртовим типом (≠ глобального «роздрібного»);
    // товар — у добірці головної, щоб його SSR-ціну дав і лоадер головної.
    await db.run(
      `update public.user_categories set price_type_id = '${WHOLESALE_TYPE}' where id = '${DEFAULT_CATEGORY}'`,
    );
    await db.run(
      `update public.products set is_featured = true where id = '${PRODUCT}'`,
    );
    const env = await discountEnvironmentFor(null);
    expect(env.priceTypeId).toBe(WHOLESALE_TYPE);
    const quote = await quoteCartFor([line(PRODUCT)], null);
    const first = quote.lines[0];
    if (!first.available) throw new Error('недоступний');
    clientPrice = first.basePrice;
    expect(clientPrice).toBe(F.WHOLESALE_STATION_PRICE);
  });

  it('каталог: ціна SSR-списку й тип у priceContext — як у гостя на клієнті', async () => {
    const payload = await withStorefrontDb((tx) => loadProductListPayload(tx));
    const item = payload.items.find((i) => i.id === PRODUCT);
    expect(item?.price).toBe(clientPrice);
    expect(payload.priceContext.priceTypeId).toBe(WHOLESALE_TYPE);
  });

  it('головна: SSR-ціна добірки й розділу — як у гостя на клієнті', async () => {
    const home = await withStorefrontDb((tx) => loadHomePageData(tx));
    const featured = home.featuredProducts.find((p) => p.id === PRODUCT);
    expect(featured?.price).toBe(clientPrice);
    const inSections = Object.values(home.sectionProducts)
      .flat()
      .filter((p) => p.id === PRODUCT);
    expect(inSections.length).toBeGreaterThan(0);
    for (const p of inSections) expect(p.price).toBe(clientPrice);
  });
});
