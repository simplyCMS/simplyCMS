// Д-1: внутрішня примітка модератора не їде на вітрину. Перевірка на рівні
// рядка лоадера і на рівні серіалізованого payload — поле не має ні існувати,
// ні проливатись текстом.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import {
  loadProductReviews,
  withCustomerDb,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';
import { resolveHarness } from '../up.mjs';
import {
  applyCanon,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';
import { PRODUCT, SEED_STATEMENTS, USER_A } from './fixtures/rls-actors';

const NOTE = 'внутрішнє';

describe('Д-1: вітрина без admin_comment', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_review_payload');
  let dbUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applyCanon(dbUrl);
    for (const statement of SEED_STATEMENTS) await queryRows(dbUrl, statement);
    // Примітка і на власному pending A, і на схваленому чужому (B).
    await queryRows(
      dbUrl,
      `update public.product_reviews set admin_comment = $1`,
      [NOTE],
    );
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('автор бачить свій pending без admin_comment', async () => {
    const rows = await withCustomerDb(USER_A, (db) =>
      loadProductReviews(db, PRODUCT),
    );
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.status === 'pending')).toBe(true);
    for (const row of rows)
      expect(Object.keys(row)).not.toContain('admin_comment');
    expect(JSON.stringify(rows)).not.toContain(NOTE);
  });

  it('гість бачить схвалений чужий без admin_comment', async () => {
    const rows = await withStorefrontDb((db) =>
      loadProductReviews(db, PRODUCT),
    );
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!)).not.toContain('admin_comment');
    expect(JSON.stringify(rows)).not.toContain(NOTE);
  });
});
