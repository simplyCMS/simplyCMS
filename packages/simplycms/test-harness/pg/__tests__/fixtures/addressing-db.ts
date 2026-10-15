// Спільна БД реєстрів адрес і токенів (М1, Task 5): канон на чистій базі,
// `DATABASE_URL` під app_runtime (генератори ядра ходять через `withActor`),
// фікстури товарів/модифікацій/мов власником і raw-транзакції від app_admin.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll } from 'vitest';
import { closeDbPool, withActor, type ActorDb } from 'simplycms/db';
import { resolveHarness } from '../../up.mjs';
import * as H from '../../apply.mjs';
import { withActor as rawActor } from '../../actors.mjs';

export const ADMIN = {
  userId: '33333333-3333-4333-8333-333333333333',
  role: 'app_admin',
} as const;

export interface AddressingDb {
  /** SQL власником БД: фікстури й перевірки стану. */
  q: (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
  /** Транзакція ядра від app_admin (коміт — у кінці `fn`). */
  admin: <T>(fn: (db: ActorDb) => Promise<T>) => Promise<T>;
  /** Сирі стейтменти однією транзакцією app_admin; відкладені тригери — на COMMIT. */
  tx: (...statements: string[]) => Promise<unknown>;
  product: (slug?: string) => Promise<string>;
  modification: (productId: string, slug?: string) => Promise<string>;
  /** Додає мову (за замовчуванням `published`). */
  language: (code: string, status?: string) => Promise<void>;
}

export function useAddressingDb(prefix: string): AddressingDb {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = H.randomDbName(prefix);
  let dbUrl = '';
  let runtimeUrl = '';

  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, dbName);
    dbUrl = H.withDbName(harness.url, dbName);
    await H.applyCanon(dbUrl);
    runtimeUrl = H.withUser(dbUrl, 'app_runtime');
    process.env.DATABASE_URL = runtimeUrl;
  }, 120_000);

  afterAll(async () => {
    // Пул закриваємо першим: інакше DROP DATABASE чекає живі зʼєднання.
    await closeDbPool();
    if (dbUrl) await H.dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const q: AddressingDb['q'] = (sql, params = []) =>
    H.queryRows(dbUrl, sql, params) as Promise<Record<string, unknown>[]>;

  return {
    q,
    admin: (fn) => withActor({ role: 'app_admin', userId: ADMIN.userId }, fn),
    tx: (...statements) => rawActor(runtimeUrl, ADMIN, statements),
    product: async (slug = `p-${randomUUID()}`) => {
      const id = randomUUID();
      await q(
        `insert into public.products (id, slug, name) values ($1,$2::varchar,$2::text)`,
        [id, slug],
      );
      return id;
    },
    modification: async (productId, slug = `m-${randomUUID()}`) => {
      const id = randomUUID();
      await q(
        `insert into public.product_modifications (id, product_id, slug, name) values ($1,$2,$3::varchar,$3::text)`,
        [id, productId, slug],
      );
      return id;
    },
    language: async (code, status = 'published') => {
      await q(
        `insert into public.languages (id, code, name, status, is_default, sort_order)
         values (gen_random_uuid(), $1::text, $1::text, $2::language_status, false, 5)`,
        [code, status],
      );
    },
  };
}
