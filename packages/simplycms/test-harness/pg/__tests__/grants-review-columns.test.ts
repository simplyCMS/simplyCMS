// К3-Е6д-7 (Е6д-16 б, Е6д-23): `app_user` пише `product_reviews` лише
// колонковим UPDATE-грантом, а політика `product_reviews_update_own` дозволяє
// правити й approved-відгук, але лише з поверненням у `pending`.
//
// Негатив розрізняє два шари: `permission denied` (42501 від гранту — колонка
// заборонена взагалі) і `new row violates row-level security policy` (той самий
// код 42501, але від WITH CHECK — колонка дозволена, значення ні).
// INSERT грантом табличний (drizzle називає всі колонки), тож `status` і
// `admin_comment` звужує політика `product_reviews_insert_own`.
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
import { withActor } from '../actors.mjs';
import { COLUMN_GRANTS } from './fixtures/grants';
import { SEED_STATEMENTS, USER_A, USER_B } from './fixtures/rls-actors';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');
const DENIED = /permission denied/;
const RLS = /new row violates row-level security policy/;
const AS_A = { userId: USER_A, role: 'app_user' };

/** Значення для позитивного кейсу кожної колонки з декларації. */
const VALUES: Record<string, string> = {
  rating: '3',
  title: `'Оновлено'`,
  content: `'<p>текст</p>'`,
  images: `'["k"]'`,
  status: `'pending'`,
  updated_at: 'now()',
};

describe('Е6д-16 б: колонкові гранти INSERT/UPDATE product_reviews для app_user', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_review_columns');
  let dbUrl = '';
  let runtimeUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => join(CANON_DIR, name)),
    );
    // Сід містить pending-відгук A (4★) — саме його й правимо.
    for (const statement of SEED_STATEMENTS) await queryRows(dbUrl, statement);
    runtimeUrl = withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const reviewOf = async (productId: string) =>
    (
      await queryRows(
        dbUrl,
        `select * from public.product_reviews where user_id = $1 and product_id = $2`,
        [USER_A, productId],
      )
    )[0];

  /** Свіжий товар: у A уже є відгук на PRODUCT, а (product, user) унікальні. */
  const freshProduct = async () => {
    const id = randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name) values ($1, $2, 'Т')`,
      [id, `p-${id}`],
    );
    return id;
  };

  /** Власний відгук A із заданим статусом (суперюзер — грант не заважає). */
  const seedReview = async (status: string) => {
    const productId = await freshProduct();
    await queryRows(
      dbUrl,
      `insert into public.product_reviews (id, product_id, user_id, rating, status)
       values ($1, $2, $3, 5, $4)`,
      [randomUUID(), productId, USER_A, status],
    );
    return productId;
  };

  const insertSql = (productId: string, extra = '', extraValue = '') =>
    `insert into public.product_reviews (id, product_id, user_id, rating${extra})
     values (gen_random_uuid(), '${productId}', '${USER_A}', 4${extraValue})`;

  describe('INSERT', () => {
    it('із status = approved → помилка RLS', async () => {
      const p = await freshProduct();
      await expect(
        withActor(runtimeUrl, AS_A, [insertSql(p, ', status', `, 'approved'`)]),
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringMatching(RLS),
      });
    });

    it('із admin_comment → помилка RLS', async () => {
      const p = await freshProduct();
      await expect(
        withActor(runtimeUrl, AS_A, [insertSql(p, ', admin_comment', `, 'x'`)]),
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringMatching(RLS),
      });
    });

    it('без status → pending (DEFAULT)', async () => {
      const p = await freshProduct();
      await withActor(runtimeUrl, AS_A, [insertSql(p)]);
      expect((await reviewOf(p))!.status).toBe('pending');
    });
  });

  describe('UPDATE', () => {
    it('set status = approved власного pending → помилка RLS', async () => {
      const p = await seedReview('pending');
      await expect(
        withActor(runtimeUrl, AS_A, [
          `update public.product_reviews set status = 'approved'
           where user_id = '${USER_A}' and product_id = '${p}'`,
        ]),
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringMatching(RLS),
      });
      expect((await reviewOf(p))!.status).toBe('pending');
    });

    it('правка approved без повернення в pending → помилка RLS', async () => {
      const p = await seedReview('approved');
      await expect(
        withActor(runtimeUrl, AS_A, [
          `update public.product_reviews set rating = 4
           where user_id = '${USER_A}' and product_id = '${p}'`,
        ]),
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringMatching(RLS),
      });
      expect((await reviewOf(p))!.rating).toBe(5);
    });

    it('правка approved з status = pending → 1 рядок, статус pending', async () => {
      const p = await seedReview('approved');
      const rows = await withActor(runtimeUrl, AS_A, [
        `update public.product_reviews set rating = 4, status = 'pending'
         where user_id = '${USER_A}' and product_id = '${p}' returning status`,
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.status).toBe('pending');
    });

    it('чужого відгуку → 0 рядків', async () => {
      const rows = await withActor(runtimeUrl, AS_A, [
        `update public.product_reviews set rating = 1, status = 'pending'
         where user_id = '${USER_B}' returning id`,
      ]);
      expect(rows).toHaveLength(0);
    });

    it('admin_comment → permission denied', async () => {
      const p = await seedReview('pending');
      await expect(
        withActor(runtimeUrl, AS_A, [
          `update public.product_reviews set admin_comment = 'x'
           where user_id = '${USER_A}' and product_id = '${p}'`,
        ]),
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringMatching(DENIED),
      });
    });

    it('user_id → permission denied (перепривʼязка автора)', async () => {
      const p = await seedReview('pending');
      await expect(
        withActor(runtimeUrl, AS_A, [
          `update public.product_reviews set user_id = '${USER_B}'
           where user_id = '${USER_A}' and product_id = '${p}'`,
        ]),
      ).rejects.toMatchObject({
        code: '42501',
        message: expect.stringMatching(DENIED),
      });
    });

    it('images → дозволено', async () => {
      const p = await seedReview('pending');
      const rows = await withActor(runtimeUrl, AS_A, [
        `update public.product_reviews set images = '["k"]'
         where user_id = '${USER_A}' and product_id = '${p}' returning id`,
      ]);
      expect(rows).toHaveLength(1);
    });
  });

  const declared = COLUMN_GRANTS.product_reviews!.app_user!.UPDATE!;

  it('декларація покрита значеннями тесту (нова колонка не пройде повз позитив)', () => {
    expect(Object.keys(VALUES).sort()).toEqual(declared);
  });

  it.each(declared)(
    'app_user: колонка %s оновлюється (свій відгук у pending)',
    async (column) => {
      const p = await seedReview('pending');
      const rows = await withActor(runtimeUrl, AS_A, [
        `update public.product_reviews set ${column} = ${VALUES[column]}
         where user_id = '${USER_A}' and product_id = '${p}' returning id`,
      ]);
      expect(rows).toHaveLength(1);
    },
  );
});
