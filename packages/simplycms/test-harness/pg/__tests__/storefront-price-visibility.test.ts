// Р29 (А6.3): публічні лоадери вітрини віддають `product_prices` лише видів
// цін ГЛЯДАЧА. Гість — гостьові види; покупець — вид своєї категорії +
// гостьові як фолбек; покупець дефолтної категорії гуртового не бачить.
// Фільтр на сервері, глядач — лише з ідентичності сесії (`withViewerPricesDb`
// приймає той id, що `withViewerDb` бере з `readSessionSubject`).
import { beforeAll, describe, expect, it } from 'vitest';
import type { PriceEntry } from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';
import {
  loadCatalogProducts,
  loadHomePageData,
  loadProduct,
  loadProductList,
  loadPropertyOption,
} from 'simplycms/storefront/loaders';
// Ядро `withViewerDb` без сесії — поза публічним барелем (Р29, M1).
import { withViewerPricesDb } from '../../../src/storefront/loaders/viewer-prices-db';
import type { ViewerPriceTypes } from 'simplycms/commerce';
import * as F from './fixtures/commerce';
import { useCommerceDb } from './fixtures/commerce-db';

const WHOLESALE_TYPE = 'c0000002-0000-4000-8000-000000000001';
const RETAIL_EMAIL = 'commerce-retail@example.test';
const STATION_SLUG = 'stantsiya-nakopychennya-10kwh';

/** Усі `product_prices` усіх пʼяти публічних лоадерів одним списком. */
async function allPublicPrices(
  db: ActorDb,
  viewer: ViewerPriceTypes,
): Promise<PriceEntry[]> {
  const product = await loadProduct(db, STATION_SLUG, viewer);
  const catalog = await loadCatalogProducts(db, viewer);
  const home = await loadHomePageData(db, viewer);
  const option = await loadPropertyOption(db, 'tip-paneli', 'mono', viewer);
  const list = await loadProductList(db, viewer);
  expect(product).not.toBeNull();
  expect(option?.products.length).toBeGreaterThan(0);
  return [
    ...(product?.product_prices ?? []),
    ...catalog.flatMap((row) => row.product_prices),
    ...home.featuredProducts.flatMap((row) => row.prices),
    ...home.newProducts.flatMap((row) => row.prices),
    ...Object.values(home.sectionProducts)
      .flat()
      .flatMap((row) => row.prices),
    ...(option?.products ?? []).flatMap((row) => row.product_prices),
    ...list.flatMap((row) => row.product_prices),
  ];
}

const typesOf = (prices: PriceEntry[]) =>
  new Set(prices.map((p) => p.price_type_id));

describe('ціни вітрини лише для виду глядача (Р29)', () => {
  const db = useCommerceDb('simplycms_price_visibility');
  let retailId = '';
  let guestTypeId = '';

  beforeAll(async () => {
    // Гуртова ціна — на КОЖНОМУ товарі (у фікстурі лише станція): так її
    // мусить відсікти кожен лоадер, а не лише той, що читає станцію.
    await db.run(
      `insert into public.product_prices (id, price_type_id, product_id, modification_id, price)
       select gen_random_uuid(), '${WHOLESALE_TYPE}', p.id, null, 1
         from public.products p where p.id <> '${F.STATION_10KWH}'`,
    );
    await db.run(
      `update public.products set is_featured = true where id = '${F.STATION_10KWH}'`,
    );
    // Сторінка значення характеристики (демо лишає `has_page = false`).
    await db.run(
      `update public.section_properties set has_page = true where slug = 'tip-paneli'`,
    );
    // Покупець без персональної категорії — ефективна для нього дефолтна.
    await db.run(
      `insert into public.users (name, email, email_verified) values ('Роздріб', '${RETAIL_EMAIL}', true)`,
    );
    const [user] = (await db.run(
      `select id from public.users where email = '${RETAIL_EMAIL}'`,
    )) as { id: string }[];
    retailId = user.id;
    await db.run(
      `insert into public.profiles (id, user_id, email, first_name, category_id)
       values (gen_random_uuid(), '${retailId}', '${RETAIL_EMAIL}', 'Роздріб', null)`,
    );
    const [guest] = (await db.run(
      `select price_type_id as id from public.user_categories where is_default`,
    )) as { id: string }[];
    guestTypeId = guest.id;
    expect(guestTypeId).not.toBe(WHOLESALE_TYPE);
  });

  it('гість: жоден публічний лоадер не віддає гуртового виду', async () => {
    const prices = await withViewerPricesDb(null, allPublicPrices);
    expect(prices.length).toBeGreaterThan(0);
    expect(typesOf(prices).has(WHOLESALE_TYPE)).toBe(false);
    expect(prices.some((p) => p.price === F.WHOLESALE_STATION_PRICE)).toBe(
      false,
    );
  });

  it('гість: getProduct (картка) без гуртового виду', async () => {
    const product = await withViewerPricesDb(null, (tx, v) =>
      loadProduct(tx, STATION_SLUG, v),
    );
    expect(typesOf(product!.product_prices)).toEqual(new Set([guestTypeId]));
  });

  it('гість: каталог без гуртового виду', async () => {
    const rows = await withViewerPricesDb(null, (tx, v) =>
      loadCatalogProducts(tx, v),
    );
    const types = typesOf(rows.flatMap((row) => row.product_prices));
    expect(types.has(WHOLESALE_TYPE)).toBe(false);
    expect(types.has(guestTypeId)).toBe(true);
  });

  it('гість: loadProductList (публічний, README) без гуртового виду', async () => {
    const rows = await withViewerPricesDb(null, (tx, v) =>
      loadProductList(tx, v),
    );
    const types = typesOf(rows.flatMap((row) => row.product_prices));
    expect(types.has(WHOLESALE_TYPE)).toBe(false);
    expect(types.has(guestTypeId)).toBe(true);
  });

  it('покупець гуртової категорії: loadProductList несе його вид', async () => {
    const rows = await withViewerPricesDb(db.wholesale, (tx, v) =>
      loadProductList(tx, v),
    );
    expect(
      typesOf(rows.flatMap((row) => row.product_prices)).has(WHOLESALE_TYPE),
    ).toBe(true);
  });

  it('покупець гуртової категорії: його вид є, гостьовий як фолбек є', async () => {
    const prices = await withViewerPricesDb(db.wholesale, allPublicPrices);
    const types = typesOf(prices);
    expect(types.has(WHOLESALE_TYPE)).toBe(true);
    expect(types.has(guestTypeId)).toBe(true);
    const product = await withViewerPricesDb(db.wholesale, (tx, v) =>
      loadProduct(tx, STATION_SLUG, v),
    );
    expect(
      product!.product_prices.find((p) => p.price_type_id === WHOLESALE_TYPE)
        ?.price,
    ).toBe(F.WHOLESALE_STATION_PRICE);
  });

  it('покупець дефолтної категорії: гуртового виду немає', async () => {
    const prices = await withViewerPricesDb(retailId, allPublicPrices);
    expect(prices.length).toBeGreaterThan(0);
    expect(typesOf(prices).has(WHOLESALE_TYPE)).toBe(false);
  });
});
