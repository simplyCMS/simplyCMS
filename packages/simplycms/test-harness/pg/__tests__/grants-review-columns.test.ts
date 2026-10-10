// К3-Е6д, Task 5 (Е6д-16 б): `app_user` оновлює `product_reviews` лише
// колонковим грантом `rating, title, content, updated_at`.
//
// Негатив — 42501 саме на кожній забороненій колонці окремо, а не «RLS
// відфільтрувала рядок»: відгук свій і `pending`, тож відмову дає грант.
// `images` — ключ файла, який покупець не вправі вписувати (власність
// медіа перевіряє сховище, а не БД); `status`/`admin_comment` — модерація;
// `user_id` — перепривʼязка відгуку до іншого автора.
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
const AS_A = { userId: USER_A, role: 'app_user' };

/** Значення для позитивного кейсу кожної колонки з декларації. */
const VALUES: Record<string, string> = {
  rating: '3',
  title: `'Оновлено'`,
  content: `'<p>текст</p>'`,
  updated_at: 'now()',
};

describe('Е6д-16 б: колонковий UPDATE product_reviews для app_user', () => {
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

  const ownReview = async () =>
    (
      await queryRows(
        dbUrl,
        `select * from public.product_reviews where user_id = $1`,
        [USER_A],
      )
    )[0];

  it.each([
    ['images', `'["k"]'`],
    ['status', `'approved'`],
    ['admin_comment', `'x'`],
    ['user_id', `'${USER_B}'`],
  ])(
    'app_user: update product_reviews set %s → 42501, рядок незмінний',
    async (column, value) => {
      const before = await ownReview();
      await expect(
        withActor(runtimeUrl, AS_A, [
          `update public.product_reviews set ${column} = ${value}
           where user_id = '${USER_A}'`,
        ]),
      ).rejects.toMatchObject({ code: '42501' });
      expect(await ownReview()).toEqual(before);
    },
  );

  const declared = COLUMN_GRANTS.product_reviews!.app_user!.UPDATE!;

  it('декларація покрита значеннями тесту (нова колонка не пройде повз позитив)', () => {
    expect(Object.keys(VALUES).sort()).toEqual(declared);
  });

  it.each(declared)(
    'app_user: колонка %s оновлюється (свій pending)',
    async (column) => {
      const rows = await withActor(runtimeUrl, AS_A, [
        `update public.product_reviews set ${column} = ${VALUES[column]}
       where user_id = '${USER_A}' returning id`,
      ]);
      expect(rows).toHaveLength(1);
    },
  );
});
