// БД і сід харнес-тестів адмінки знижок (К3-Е6в, Task 5): канон → (опційно
// демо-сід + фікстури контуру commerce для priceItems) → app_runtime →
// afterAll із closeDbPool() ПЕРШИМ. Групи й знижки сідяться привілейованим
// підключенням — повз guard, це сід, а не перевірка.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { resolveHarness } from '../../up.mjs';
import * as H from '../../apply.mjs';
import { COMMERCE_FIXTURE_STATEMENTS, WHOLESALE_EMAIL } from './commerce';

export { conflict, rows } from './admin-shipping';
export { discountInput, invalid } from './admin-discount-input';
import { rows } from './admin-shipping';

const MIGRATIONS = join(import.meta.dirname, '../../../../migrations');

/** `commerce: true` — демо-сід і гуртовий покупець контуру (кейс priceItems). */
export function useDiscountsAdminDb(
  prefix: string,
  opts: { commerce?: boolean } = {},
): { url: () => string; wholesale: () => string } {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = H.randomDbName(prefix);
  let dbUrl = '';
  let wholesale = '';
  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, dbName);
    dbUrl = H.withDbName(harness.url, dbName);
    const files = readdirSync(MIGRATIONS)
      .filter((n) => n.endsWith('.sql'))
      .sort()
      .map((n) => join(MIGRATIONS, n));
    if (opts.commerce) files.push(join(MIGRATIONS, 'demo/demo-seed.sql'));
    await H.applySqlFiles(dbUrl, files);
    if (opts.commerce) {
      for (const s of COMMERCE_FIXTURE_STATEMENTS) await H.queryRows(dbUrl, s);
      const [u] = await rows(
        dbUrl,
        `select id from public.users where email = $1`,
        [WHOLESALE_EMAIL],
      );
      wholesale = String(u!.id);
    }
    process.env.DATABASE_URL = H.withUser(dbUrl, 'app_runtime');
  }, 120_000);
  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await H.dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });
  return { url: () => dbUrl, wholesale: () => wholesale };
}

let seq = 0;

/** Група знижок; `parent` — батьківська група, дати — ISO-рядки. */
export async function seedGroup(
  url: string,
  o: { parent?: string; startsAt?: string; endsAt?: string } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  await rows(
    url,
    `insert into public.discount_groups (id, name, parent_group_id, starts_at, ends_at)
     values ($1, $2, $3, $4, $5)`,
    [
      id,
      `Група Е6в ${++seq}`,
      o.parent ?? null,
      o.startsAt ?? null,
      o.endsAt ?? null,
    ],
  );
  return id;
}

/** Знижка з ціллю `all` (без умов) — щоб каскад мав що видаляти. */
export async function seedDiscount(url: string, groupId: string) {
  const id = crypto.randomUUID();
  await rows(
    url,
    `insert into public.discounts (id, name, group_id, discount_value) values ($1, 'Сід Е6в', $2, 5)`,
    [id, groupId],
  );
  await rows(
    url,
    `insert into public.discount_targets (id, discount_id, target_type) values ($1, $2, 'all')`,
    [crypto.randomUUID(), id],
  );
  return id;
}

export async function seedCategory(url: string): Promise<string> {
  const id = crypto.randomUUID();
  await rows(
    url,
    `insert into public.user_categories (id, name, code) values ($1, $2, $3)`,
    [id, `Категорія ${++seq}`, `e6v-cat-${seq}`],
  );
  return id;
}

/** Стан знижки в БД: рядок, цілі й умови (порожні масиви — знижки немає). */
export const snapshotDiscount = async (url: string, id: string) => ({
  discount: await rows(
    url,
    `select id, name, group_id, discount_type, discount_value::text, price_type_id,
            priority, is_active, starts_at, ends_at, updated_at
       from public.discounts where id = $1`,
    [id],
  ),
  targets: await rows(
    url,
    `select id, target_type, target_id from public.discount_targets
      where discount_id = $1 order by id`,
    [id],
  ),
  conditions: await rows(
    url,
    `select id, condition_type, operator, value from public.discount_conditions
      where discount_id = $1 order by id`,
    [id],
  ),
});

export const snapshotGroups = (url: string, ids: string[]) =>
  rows(
    url,
    `select id, name, parent_group_id, starts_at, ends_at, updated_at
       from public.discount_groups where id = any($1::uuid[]) order by id`,
    [ids],
  );
