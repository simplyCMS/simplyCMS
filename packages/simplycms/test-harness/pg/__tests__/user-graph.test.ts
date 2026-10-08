// Граф користувача (Е6г, Г-5/Г-6): що відбувається з усіма рядками, які
// посилаються на `users(id)`, коли покупця видаляють. Без FK видалення лишало
// б сиріт (адреси, відгуки) або падало на `orders_user_id_fkey`.
// Видалення йде під `app_admin` — ролью, якою його виконає адмін-операція.
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

const CANON_DIR = join(import.meta.dirname, '../../../migrations');
import {
  ADMIN,
  BUYER,
  MEDIA,
  ORDER_ERASED,
  ORDER_LIVE,
  OTHER,
  SEED,
} from './fixtures/user-graph';

describe('граф користувача: видалення users', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_user_graph');
  let dbUrl: string;
  const q = (sql: string) => queryRows(dbUrl, sql);
  const count = async (table: string, where: string) =>
    (
      (
        await q(`select count(*)::int n from public.${table} where ${where}`)
      )[0] as { n: number }
    ).n;

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => join(CANON_DIR, n)),
    );
    for (const stmt of SEED) await q(stmt);
  }, 120_000);

  afterAll(async () => {
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const orphans = async () => {
    const cols = (await q(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public'
          and column_name in ('user_id', 'changed_by', 'uploaded_by')`,
    )) as { table_name: string; column_name: string }[];
    expect(cols.length).toBeGreaterThan(10);
    const result: Record<string, number> = {};
    for (const { table_name: t, column_name: c } of cols) {
      const n = (
        (await q(
          `select count(*)::int n from public."${t}" x
            where x."${c}" is not null
              and not exists (select 1 from public.users u where u.id = x."${c}")`,
        )) as { n: number }[]
      )[0]!.n;
      if (n > 0) result[`${t}.${c}`] = n;
    }
    return result;
  };

  it('CHECK: ПД не можна обнулити без personal_data_erased_at', async () => {
    const nullify = (extra = '') =>
      q(
        `update public.orders set first_name = null${extra} where id = '${ORDER_LIVE}'`,
      );
    await expect(nullify()).rejects.toMatchObject({ code: '23514' });
    await expect(nullify(', personal_data_erased_at = now()')).resolves.toEqual(
      [],
    );
    await q(
      `update public.orders set first_name = 'Ім', personal_data_erased_at = null where id = '${ORDER_LIVE}'`,
    );
  });

  it('видалення: власні рядки зникли, чужі й журнальні лишились з NULL', async () => {
    expect(await orphans()).toEqual({});
    const runtime = withUser(dbUrl, 'app_runtime');
    await withActor(runtime, { userId: ADMIN, role: 'app_admin' }, [
      `delete from public.users where id = '${BUYER}'`,
    ]);

    for (const t of [
      'user_addresses',
      'user_recipients',
      'wishlists',
      'comparisons',
    ]) {
      expect(await count(t, `user_id = '${BUYER}'`), t).toBe(0);
    }
    expect(await count('user_category_history', `user_id = '${BUYER}'`)).toBe(
      0,
    );
    // Чужа історія пережила: лише `changed_by` обнулено.
    expect(
      await q(`select user_id, changed_by from public.user_category_history`),
    ).toEqual([{ user_id: OTHER, changed_by: null }]);
    expect(await q(`select user_id from public.product_reviews`)).toEqual([
      { user_id: null },
    ]);
    expect(
      await q(`select uploaded_by from public.media where id = '${MEDIA}'`),
    ).toEqual([{ uploaded_by: null }]);
    expect(
      await q(`select user_id, personal_data_erased_at is not null as erased
                 from public.orders where id = '${ORDER_ERASED}'`),
    ).toEqual([{ user_id: null, erased: true }]);
    expect(await count('orders', `user_id is null`)).toBe(2);
  });

  it('сиріт немає: кожне посилання на users існує в users', async () => {
    expect(await orphans()).toEqual({});
  });
});
