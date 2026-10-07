// Спільна БД контуру `simplycms/commerce` (К3-Е5б, Task 1): канон міграцій +
// демо-сід + негативна доставка + фікстури `./commerce`. Реєструє хуки
// `beforeAll`/`afterAll` у describe, що її кличе, і віддає id, прочитані з БД.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import type { CheckoutItemInput } from 'simplycms/contracts';
import { closeDbPool, withActor, type ActorDb } from 'simplycms/db';
import { resolveHarness } from '../../up.mjs';
import * as H from '../../apply.mjs';
import { HIDDEN_METHOD_CODE, HIDDEN_SHIPPING_FIXTURES } from './shipping';
import {
  COMMERCE_FIXTURE_STATEMENTS,
  COURIER_CODE,
  WHOLESALE_EMAIL,
} from './commerce';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../../migrations');

export type CommerceIds = Record<
  'wholesale' | 'pickup' | 'point' | 'closed' | 'courier' | 'hidden',
  string
>;

/** Id контуру + SQL суперкористувачем у його БД — тест-локальні фікстури. */
export type CommerceDb = CommerceIds & {
  run: (statement: string) => Promise<unknown[]>;
};

/** Транзакція гостя — той самий актор, що в чекауті без сесії. */
export const guest = <T>(fn: (db: ActorDb) => Promise<T>): Promise<T> =>
  withActor({ role: 'app_user' }, fn);

/** Позиція запиту ціноутворення. */
export const line = (
  productId: string,
  quantity = 1,
  modificationId: string | null = null,
): CheckoutItemInput => ({ productId, modificationId, quantity });

export function useCommerceDb(prefix: string): CommerceDb {
  const ids: CommerceDb = {
    run: (statement) => H.queryRows(dbUrl, statement) as Promise<unknown[]>,
    wholesale: '',
    pickup: '',
    point: '',
    closed: '',
    courier: '',
    hidden: '',
  };
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = H.randomDbName(prefix);
  let dbUrl = '';
  const one = async (sql: string, p: unknown[]): Promise<string> =>
    ((await H.queryRows(dbUrl, sql, p)) as { id: string }[])[0].id;

  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, dbName);
    dbUrl = H.withDbName(harness.url, dbName);
    await H.applySqlFiles(dbUrl, [
      ...readdirSync(MIGRATIONS_DIR)
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => join(MIGRATIONS_DIR, n)),
      join(MIGRATIONS_DIR, 'demo/demo-seed.sql'),
    ]);
    for (const s of [
      ...HIDDEN_SHIPPING_FIXTURES,
      ...COMMERCE_FIXTURE_STATEMENTS,
    ])
      await H.queryRows(dbUrl, s);
    const method = `select id from public.shipping_methods where code = $1`;
    const point = `select id from public.pickup_points where name = $1`;
    ids.wholesale = await one(`select id from public.users where email = $1`, [
      WHOLESALE_EMAIL,
    ]);
    ids.pickup = await one(method, ['pickup']);
    ids.courier = await one(method, [COURIER_CODE]);
    ids.hidden = await one(method, [HIDDEN_METHOD_CODE]);
    ids.point = await one(point, ['Склад у Києві']);
    ids.closed = await one(point, ['Закритий склад']);
    process.env.DATABASE_URL = H.withUser(dbUrl, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    await H.dropTempDatabase(harness.url, dbName);
    await harness.teardown();
  });

  return ids;
}
