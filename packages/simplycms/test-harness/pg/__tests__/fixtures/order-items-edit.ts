// БД харнес-тестів редагування позицій замовлення (К3-Е5б Task 3): канон +
// демо-сід + фікстури контуру `commerce` (гуртовик, курʼєр із `free_from` і
// мінімумом, знижка «від суми») + власні: фіксований тариф із копійками,
// тариф «відсоток від суми», гуртова ціна й знижка панелі. Оформлення —
// воронкою вітрини, редагування — іменованими операціями адмінки
// (хелпери — `./order-items-edit-helpers`).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { closeDbPool } from 'simplycms/db';
import { resolveHarness } from '../../up.mjs';
import * as H from '../../apply.mjs';
import { COMMERCE_FIXTURE_STATEMENTS } from './commerce';
import { percentDiscountStatements } from './discounts';
import { restrictOrdersSelectForAdmin } from './orders';
import {
  EDIT_FIXTURE_STATEMENTS,
  METHODS,
  SLUGS,
  type EditIds,
} from './order-items-edit-data';
import { editHelpers } from './order-items-edit-helpers';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../../migrations');
export const conflict = (constraint: string) => ({
  name: 'AdminConflictError',
  kind: 'state',
  constraint,
});

export function useOrderItemsEditDb(prefix: string) {
  const ids = {} as EditIds;
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = H.randomDbName(prefix);
  const db = { url: '' };
  const rows = async <T>(text: string, p: unknown[] = []) =>
    (await H.queryRows(db.url, text, p)) as T[];
  const one = async <T>(text: string, p: unknown[] = []) =>
    (await rows<T>(text, p))[0]!;
  const id = async (text: string, p: unknown[]) =>
    (await one<{ id: string }>(text, p)).id;

  beforeAll(async () => {
    harness = await resolveHarness();
    await H.createTempDatabase(harness.url, dbName);
    db.url = H.withDbName(harness.url, dbName);
    await H.applySqlFiles(db.url, [
      ...readdirSync(MIGRATIONS_DIR)
        .filter((n) => n.endsWith('.sql'))
        .sort()
        .map((n) => join(MIGRATIONS_DIR, n)),
      join(MIGRATIONS_DIR, 'demo/demo-seed.sql'),
    ]);
    for (const s of [
      ...COMMERCE_FIXTURE_STATEMENTS,
      ...EDIT_FIXTURE_STATEMENTS,
      ...percentDiscountStatements({
        group: 'Гурт панелі',
        name: 'Гурт панелі −10%',
        percent: 10,
        priceTypeCode: 'commerce-wholesale',
        target: { type: 'product', slug: SLUGS.panel },
      }),
    ])
      await H.queryRows(db.url, s);
    for (const [key, slug] of Object.entries(SLUGS))
      ids[key as keyof typeof SLUGS] = await id(
        `select id from public.products where slug = $1`,
        [slug],
      );
    for (const [key, code] of Object.entries(METHODS))
      ids[key as keyof typeof METHODS] = await id(
        `select id from public.shipping_methods where code = $1`,
        [code],
      );
    ids.point = await id(
      `select id from public.pickup_points where is_system`,
      [],
    );
    ids.wholesale = await id(`select id from public.users where email = $1`, [
      'commerce-wholesale@example.test',
    ]);
    ids.user = await id(
      `insert into public.users (id, name, email, email_verified)
       values (gen_random_uuid(), 'Покупець', $1, true) returning id`,
      ['e5b-buyer@example.test'],
    );
    await helpers.setStock(ids.panel, 1000);
    await restrictOrdersSelectForAdmin(db.url);
    process.env.DATABASE_URL = H.withUser(db.url, 'app_runtime');
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (db.url) await H.dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  const helpers = editHelpers({ ids, rows, one, id });
  return { ids, db, rows, ...helpers };
}
