// БД і сід харнес-тестів категорій покупців і автоправил (К3-Е6в, Task 6):
// канон (+ опційно демо-сід для оформлення замовлень) → app_runtime →
// afterAll із closeDbPool() ПЕРШИМ. Покупці, категорії й правила сідяться
// привілейованим підключенням — повз guard: це сід, а не перевірка.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { resolveHarness } from '../../up.mjs';
import * as H from '../../apply.mjs';
import { rows } from './admin-shipping';

export { conflict, rows } from './admin-shipping';
export { invalid } from './admin-discount-input';

const MIGRATIONS = join(import.meta.dirname, '../../../../migrations');

/** Дефолтна категорія «Роздріб» з `0003_seed.sql`. */
export const DEFAULT_CATEGORY = '00000004-0000-4000-8000-000000000001';
/** Субʼєкт гранта в моку `requireGrant` — автор ручних призначень. */
export const ADMIN_ID = 'a0000000-0000-4000-8000-00000000e6a1';

/** Умова «2+ замовлення». */
export const ORDERS_GTE_2 = {
  type: 'all',
  rules: [{ field: 'orders_count', operator: '>=', value: '2' }],
};

export function useCustomersDb(
  prefix: string,
  opts: { demo?: boolean } = {},
): { url: () => string } {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = H.randomDbName(prefix);
  let dbUrl = '';
  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, dbName);
    dbUrl = H.withDbName(harness.url, dbName);
    const files = readdirSync(MIGRATIONS)
      .filter((n) => n.endsWith('.sql'))
      .sort()
      .map((n) => join(MIGRATIONS, n));
    if (opts.demo) files.push(join(MIGRATIONS, 'demo/demo-seed.sql'));
    await H.applySqlFiles(dbUrl, files);
    // Автор ручних призначень: `user_category_history.changed_by` — FK на users.
    await H.queryRows(
      dbUrl,
      `insert into public.users (id, name, email) values ($1, 'Адмін Е6в', 'admin-e6v@example.test')
         on conflict (id) do nothing`,
      [ADMIN_ID],
    );
    process.env.DATABASE_URL = H.withUser(dbUrl, 'app_runtime');
  }, 120_000);
  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await H.dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });
  return { url: () => dbUrl };
}

let seq = 0;

export async function seedCategory(url: string): Promise<string> {
  const id = crypto.randomUUID();
  const n = ++seq;
  await rows(
    url,
    `insert into public.user_categories (id, name, code) values ($1, $2, $3)`,
    [id, `Категорія Е6в ${n}`, `e6v-c-${n}-${id.slice(0, 6)}`],
  );
  return id;
}

/** Покупець: рядок `users` + профіль; повертає `user_id`. */
export async function seedCustomer(
  url: string,
  o: {
    categoryId?: string | null;
    locked?: boolean;
    utm?: Record<string, unknown>;
    email?: string;
  } = {},
): Promise<string> {
  const userId = crypto.randomUUID();
  const email = o.email ?? `e6v-${++seq}-${userId.slice(0, 8)}@example.test`;
  await rows(
    url,
    `insert into public.users (id, name, email, email_verified) values ($1, 'Покупець Е6в', $2, true)`,
    [userId, email],
  );
  await rows(
    url,
    `insert into public.profiles (id, user_id, email, category_id, category_locked, registration_utm)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      crypto.randomUUID(),
      userId,
      email,
      o.categoryId ?? null,
      o.locked ?? false,
      JSON.stringify(o.utm ?? {}),
    ],
  );
  return userId;
}

/** Правило напряму SQL-ем — у т.ч. зі зламаним jsonb (в обхід Zod). */
export async function seedRule(
  url: string,
  o: {
    from: string | null;
    to: string;
    conditions: unknown;
    active?: boolean;
    priority?: number;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  await rows(
    url,
    `insert into public.category_rules (id, name, from_category_id, to_category_id, conditions, is_active, priority)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
    [
      id,
      `Правило Е6в ${++seq}`,
      o.from,
      o.to,
      JSON.stringify(o.conditions),
      o.active ?? true,
      o.priority ?? 0,
    ],
  );
  return id;
}

/** Категорія й прапорець покупця. */
export const customerState = async (url: string, userId: string) =>
  (
    await rows(
      url,
      `select category_id, category_locked from public.profiles where user_id = $1`,
      [userId],
    )
  )[0];

/** Історія переведень покупця в порядку запису. */
export const historyOf = (url: string, userId: string) =>
  rows(
    url,
    `select from_category_id, to_category_id, from_category_name, to_category_name,
            reason, rule_id, changed_by
       from public.user_category_history where user_id = $1 order by created_at, id`,
    [userId],
  );
