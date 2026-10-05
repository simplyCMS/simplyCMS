// Спільний сід харнесів курсора subset (admin-subset-cursor / -pagination):
// тимчасова БД з каноном, товари й замовлення з міткою `created_at` на межі
// мілісекундного Date курсора і µs-хвостом у БД.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { productsOps } from 'simplycms/admin-server/impl';
import { resolveHarness } from '../../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../../apply.mjs';

const MIGRATIONS = join(import.meta.dirname, '../../../../migrations');
export const SECTION = '0e300000-0000-4000-8000-0000000000c1';
/** Мілісекундний Date курсора; у БД — .123456 (µs-хвіст). */
export const V = new Date('2026-01-01T00:00:00.123Z');
const TAIL = '2026-01-01 00:00:00.123456+00';
const MINUS = '2026-01-01 00:00:00.122456+00';
const PLUS = '2026-01-01 00:00:00.124456+00';

export const bound = (field: string) => [
  { field: [field], operator: 'gte' as const, value: V },
  { field: [field], operator: 'lt' as const, value: new Date(V.getTime() + 1) },
];

export interface CursorDb {
  dbUrl: string;
  dbName: string;
  harness: { url: string; teardown: () => Promise<void> };
  pids: { tail: string[]; minus: string; plus: string };
  oids: { tail: string[]; minus: string; plus: string };
}

const product = (name: string) => ({
  id: crypto.randomUUID(),
  slug: `cur-${crypto.randomUUID().slice(0, 8)}`,
  name,
  sectionId: SECTION,
});

/** Підіймає БД і сіє дані; DATABASE_URL виставляє на app_runtime. */
export async function seedCursorDb(): Promise<CursorDb> {
  const harness = await resolveHarness();
  const dbName = randomDbName('simplycms_admin_cursor');
  await createTempDatabase(harness.url, dbName);
  const dbUrl = withDbName(harness.url, dbName);
  const canon = readdirSync(MIGRATIONS)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .map((n) => join(MIGRATIONS, n));
  await applySqlFiles(dbUrl, canon);
  process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
  await queryRows(
    dbUrl,
    `insert into public.sections (id, slug, name) values ($1, 'cur-section', 'Розділ')`,
    [SECTION],
  );
  const setCreated = (table: string, id: string, at: string) =>
    queryRows(
      dbUrl,
      `update public.${table} set created_at = $1 where id = $2`,
      [at, id],
    );
  // Товари: 5 з однаковою міткою, по одному на ∓1 мс; дві пари з однаковою
  // назвою — для non-Date курсора.
  const rows = [
    ...['Альфа', 'Альфа', 'Бета', 'Бета', 'Гамма'].map(product),
    product('Мінус'),
    product('Плюс'),
  ];
  await productsOps.insert({ data: rows });
  const pids = {
    tail: rows.slice(0, 5).map((r) => r.id),
    minus: rows[5]!.id,
    plus: rows[6]!.id,
  };
  for (const id of pids.tail) await setCreated('products', id, TAIL);
  await setCreated('products', pids.minus, MINUS);
  await setCreated('products', pids.plus, PLUS);
  // Замовлення: 9 NOT NULL колонок (див. admin-catalog.test.ts).
  const mk = async (n: number) => {
    const id = crypto.randomUUID();
    await queryRows(
      dbUrl,
      `insert into public.orders (id, order_number, subtotal, total, first_name, last_name, email, phone, payment_method)
       values ($1, $2, 1, 1, 'Т', 'П', 't@example.test', '+380000000000', 'cash')`,
      [id, `CUR-${n}`],
    );
    return id;
  };
  const oids = { tail: [] as string[], minus: '', plus: '' };
  for (let i = 0; i < 3; i++) oids.tail.push(await mk(i));
  oids.minus = await mk(10);
  oids.plus = await mk(11);
  for (const id of oids.tail) await setCreated('orders', id, TAIL);
  await setCreated('orders', oids.minus, MINUS);
  await setCreated('orders', oids.plus, PLUS);
  return { dbUrl, dbName, harness, pids, oids };
}

export async function dropCursorDb(db: CursorDb | undefined): Promise<void> {
  const { closeDbPool } = await import('simplycms/db');
  await closeDbPool();
  delete process.env.DATABASE_URL;
  if (db) await dropTempDatabase(db.harness.url, db.dbName);
  await db?.harness.teardown();
}
