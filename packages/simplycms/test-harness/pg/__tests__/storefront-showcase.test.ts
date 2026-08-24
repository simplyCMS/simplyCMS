// Гейт останнього кільця вітрини: знижки, банери, залишки, відгуки.
//
// 🔴 Усі чотири правила раніше жили в БРАУЗЕРІ — разом із фільтрами `is_active`
// і зі «своїм» `user_id` у запиті. У моделі B5″ на цих таблицях або немає RLS
// узагалі (знижки, банери, точки видачі), або вона звужує рядки за АКТОРОМ
// транзакції (відгуки). Довести і те, і те можна лише на живій БД: зелений
// юніт-тест на моках сказав би рівно нічого.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { resolveDiscount } from 'simplycms/domain/discounts';
import {
  loadActivePickupPointsCount,
  loadBanners,
  loadDefaultUserCategoryId,
  loadDiscountGroups,
  loadProductRatings,
  loadProductReviews,
  loadReviewAuthors,
  loadStockInfo,
  loadUserCategoryId,
  withCustomerDb,
  withStoreOperatorDb,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';
import {
  APPROVED_RATINGS,
  BANNER_PLACEMENT,
  CLOSED_POINT_QUANTITY,
  DISABLED_DISCOUNT,
  DISCOUNT_PERCENT,
  EXPIRED_BANNER_TITLE,
  HIDDEN_BANNER_TITLE,
  OPEN_POINT_NAME,
  OPEN_POINT_QUANTITY,
  PENDING_RATING,
  RETAIL_EMAIL,
  REVIEWED_PRODUCT_SLUG,
  REVIEWER_EMAIL,
  REVIEWER_FIRST_NAME,
  SHOWCASE_FIXTURE_STATEMENTS,
  STOCK_MOD_SLUG,
  STOCK_PRODUCT_SLUG,
  TARGETED_DISCOUNT,
  WHOLESALE_CODE,
  WHOLESALE_EMAIL,
} from './fixtures/showcase';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');
/** Базова ціна, на якій міряється відсоток знижки. */
const BASE_PRICE = 1000;

/** Помічники харнеса — `.mjs`, тож форму рядка описуємо на місці. */
interface IdRow {
  id: string;
}

const filesToApply = (): string[] => [
  ...readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => join(MIGRATIONS_DIR, name)),
  join(MIGRATIONS_DIR, 'demo/demo-seed.sql'),
];

describe('вітрина: знижки, банери, залишки, відгуки', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_showcase');
  let dbUrl = '';
  const ids = {
    retailPriceType: '',
    wholesaleCategory: '',
    retailCategory: '',
    retailUser: '',
    wholesaleUser: '',
    reviewer: '',
    reviewedProduct: '',
    stockModification: '',
  };

  const firstId = async (sql: string, params?: string[]): Promise<string> => {
    const [row] = (await queryRows(dbUrl, sql, params)) as IdRow[];
    return row.id;
  };

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(dbUrl, filesToApply());
    for (const statement of SHOWCASE_FIXTURE_STATEMENTS) {
      await queryRows(dbUrl, statement);
    }

    ids.retailPriceType = await firstId(
      `select id from public.price_types where code = 'retail'`,
    );
    ids.retailCategory = await firstId(
      `select id from public.user_categories where code = 'retail'`,
    );
    ids.wholesaleCategory = await firstId(
      `select id from public.user_categories where code = $1`,
      [WHOLESALE_CODE],
    );
    ids.retailUser = await firstId(
      `select id from public.users where email = $1`,
      [RETAIL_EMAIL],
    );
    ids.wholesaleUser = await firstId(
      `select id from public.users where email = $1`,
      [WHOLESALE_EMAIL],
    );
    ids.reviewer = await firstId(
      `select id from public.users where email = $1`,
      [REVIEWER_EMAIL],
    );
    ids.reviewedProduct = await firstId(
      `select id from public.products where slug = $1`,
      [REVIEWED_PRODUCT_SLUG],
    );
    ids.stockModification = await firstId(
      `select m.id from public.product_modifications m
         join public.products p on p.id = m.product_id
        where p.slug = $1 and m.slug = $2`,
      [STOCK_PRODUCT_SLUG, STOCK_MOD_SLUG],
    );

    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  // ── Знижки ────────────────────────────────────────────────────────────────

  it('🔴 знижка категорії застосовується власнику й не тече на чужу', async () => {
    const groups = await withStorefrontDb((db) =>
      loadDiscountGroups(db, ids.retailPriceType),
    );

    const priceFor = (userCategoryId: string) =>
      resolveDiscount(BASE_PRICE, groups, {
        userCategoryId,
        quantity: 1,
        cartTotal: 0,
        productId: ids.reviewedProduct,
        isLoggedIn: true,
        now: new Date(),
      }).finalPrice;

    expect(priceFor(ids.wholesaleCategory)).toBe(
      BASE_PRICE * (1 - DISCOUNT_PERCENT / 100),
    );
    // Роздрібний покупець платить повну ціну — умова `user_category` його не
    // пропускає, хоч правило й приїхало тим самим запитом.
    expect(priceFor(ids.retailCategory)).toBe(BASE_PRICE);
  });

  it('вимкнена акція не потрапляє в дерево правил', async () => {
    const groups = await withStorefrontDb((db) =>
      loadDiscountGroups(db, ids.retailPriceType),
    );
    const names = groups.flatMap((group) =>
      group.discounts.map((discount) => discount.name),
    );

    expect(names).toContain(TARGETED_DISCOUNT);
    expect(names).not.toContain(DISABLED_DISCOUNT);
  });

  it('🔴 категорія покупця читається лише власником профілю', async () => {
    const own = await withCustomerDb(ids.wholesaleUser, (db) =>
      loadUserCategoryId(db, ids.wholesaleUser),
    );
    // Той самий лоадер, той самий аргумент — інший актор.
    const foreign = await withCustomerDb(ids.retailUser, (db) =>
      loadUserCategoryId(db, ids.wholesaleUser),
    );
    const anonymous = await withStorefrontDb((db) =>
      loadDefaultUserCategoryId(db),
    );

    expect(own).toBe(ids.wholesaleCategory);
    expect(foreign).toBeNull();
    expect(anonymous).toBe(ids.retailCategory);
  });

  // ── Банери ────────────────────────────────────────────────────────────────

  it('🔴 неактивний і прострочений банери не віддаються', async () => {
    const banners = await withStorefrontDb((db) =>
      loadBanners(db, { placement: BANNER_PLACEMENT }),
    );
    const titles = banners.map((banner) => banner.title);

    expect(titles.length).toBeGreaterThan(0);
    expect(titles).not.toContain(HIDDEN_BANNER_TITLE);
    expect(titles).not.toContain(EXPIRED_BANNER_TITLE);
  });

  it('банери звужуються розділом', async () => {
    const sectionId = await firstId(
      `select id from public.sections where slug = 'sonyachni-paneli'`,
    );
    const scoped = await withStorefrontDb((db) =>
      loadBanners(db, { placement: BANNER_PLACEMENT, sectionId }),
    );
    const all = await withStorefrontDb((db) =>
      loadBanners(db, { placement: BANNER_PLACEMENT }),
    );

    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.length).toBeLessThan(all.length);
    expect(scoped.every((banner) => banner.section_id === sectionId)).toBe(
      true,
    );
  });

  // ── Залишки ───────────────────────────────────────────────────────────────

  it('🔴 залишок закритої точки видачі не рахується й не показується', async () => {
    const { stock, points } = await withStorefrontDb(async (db) => ({
      stock: await loadStockInfo(db, {
        modificationId: ids.stockModification,
      }),
      points: await loadActivePickupPointsCount(db),
    }));

    expect(stock.totalQuantity).toBe(OPEN_POINT_QUANTITY);
    expect(stock.totalQuantity).not.toBe(
      OPEN_POINT_QUANTITY + CLOSED_POINT_QUANTITY,
    );
    expect(stock.isAvailable).toBe(true);
    expect(stock.byPoint.map((point) => point.point_name)).toEqual([
      OPEN_POINT_NAME,
    ]);
    expect(points).toBe(1);
  });

  it('невідома ціль наявності віддає порожній, а не «в наявності»', async () => {
    const stock = await withStorefrontDb((db) =>
      loadStockInfo(db, { productId: null, modificationId: null }),
    );

    expect(stock).toEqual({
      totalQuantity: 0,
      isAvailable: false,
      stockStatus: null,
      byPoint: [],
    });
  });

  // ── Відгуки ───────────────────────────────────────────────────────────────

  it('🔴 несхвалений відгук не видно стороннім, але видно авторові', async () => {
    const anonymous = await withStorefrontDb((db) =>
      loadProductReviews(db, ids.reviewedProduct),
    );
    const author = await withCustomerDb(ids.wholesaleUser, (db) =>
      loadProductReviews(db, ids.reviewedProduct),
    );
    const other = await withCustomerDb(ids.retailUser, (db) =>
      loadProductReviews(db, ids.reviewedProduct),
    );

    expect(anonymous).toHaveLength(APPROVED_RATINGS.length);
    expect(anonymous.every((row) => row.status === 'approved')).toBe(true);
    expect(author).toHaveLength(APPROVED_RATINGS.length + 1);
    expect(author.filter((row) => row.status === 'pending')).toHaveLength(1);
    expect(other).toHaveLength(APPROVED_RATINGS.length);
    expect(other.some((row) => row.rating === PENDING_RATING)).toBe(false);
  });

  it('🔴 агрегат рейтингу рахує лише схвалені — навіть під актором-автором', async () => {
    const expected = {
      avgRating:
        Math.round(
          (APPROVED_RATINGS.reduce((sum, value) => sum + value, 0) /
            APPROVED_RATINGS.length) *
            10,
        ) / 10,
      reviewCount: APPROVED_RATINGS.length,
    };

    const anonymous = await withStorefrontDb((db) =>
      loadProductRatings(db, [ids.reviewedProduct]),
    );
    // Власний `pending` політика авторові віддає — і без предиката `status`
    // він накрутив би собі рейтинг власною нерозглянутою оцінкою.
    const asAuthor = await withCustomerDb(ids.wholesaleUser, (db) =>
      loadProductRatings(db, [ids.reviewedProduct]),
    );

    expect(anonymous[ids.reviewedProduct]).toEqual(expected);
    expect(asAuthor[ids.reviewedProduct]).toEqual(expected);
  });

  it('🔴 підписи авторів недосяжні покупцеві й добираються лише оператором', async () => {
    const asCustomer = await withCustomerDb(ids.retailUser, (db) =>
      loadReviewAuthors(db, [ids.reviewer]),
    );
    const asOperator = await withStoreOperatorDb((db) =>
      loadReviewAuthors(db, [ids.reviewer]),
    );

    // Політика `profiles_select_own` не дає покупцеві чужий профіль —
    // саме тому підписи добираються окремою транзакцією `app_admin`.
    expect(asCustomer).toEqual({});
    expect(asOperator[ids.reviewer]?.first_name).toBe(REVIEWER_FIRST_NAME);
  });
});
