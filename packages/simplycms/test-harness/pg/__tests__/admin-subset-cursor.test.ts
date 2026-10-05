// Task 2 (Фундамент даних адмінки): курсор «Показати ще» @tanstack/db 0.11.3
// проти живої БД — Date і sortable-колонки в eq/gt/gte/lt/lte. Шапка — патерн
// admin-catalog.test.ts. Реальні productsOps.list і ordersOps.list.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeDbPool } from 'simplycms/db';
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

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { ordersOps, productsOps } from 'simplycms/admin-server/impl';
import { subsetInputSchema } from 'simplycms/admin-server/impl/subset';

const MIGRATIONS = join(import.meta.dirname, '../../../migrations');
const SECTION = '0e300000-0000-4000-8000-0000000000c1';
// Межа сторінки: мілісекундний Date курсора vs µs-хвіст у БД.
const V = new Date('2026-01-01T00:00:00.123Z');
const TAIL = '2026-01-01 00:00:00.123456+00';
const MINUS = '2026-01-01 00:00:00.122456+00';
const PLUS = '2026-01-01 00:00:00.124456+00';
const bound = (field: string) => [
  { field: [field], operator: 'gte' as const, value: V },
  {
    field: [field],
    operator: 'lt' as const,
    value: new Date(V.getTime() + 1),
  },
];

describe('admin: підтримка курсора subset на харнесі', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_admin_cursor');
  let dbUrl = '';
  const pids = { tail: [] as string[], minus: '', plus: '' };
  const oids = { tail: [] as string[], minus: '', plus: '' };

  const product = (name: string) => ({
    id: crypto.randomUUID(),
    slug: `cur-${crypto.randomUUID().slice(0, 8)}`,
    name,
    sectionId: SECTION,
  });
  const setCreated = (table: string, id: string, at: string) =>
    queryRows(
      dbUrl,
      `update public.${table} set created_at = $1 where id = $2`,
      [at, id],
    );

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
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
    // Товари: 5 з однаковою міткою (µs-хвіст), по одному на ∓1 мс; дві пари
    // з однаковою назвою — для non-Date курсора.
    const rows = [
      ...['Альфа', 'Альфа', 'Бета', 'Бета', 'Гамма'].map(product),
      product('Мінус'),
      product('Плюс'),
    ];
    await productsOps.insert({ data: rows });
    pids.tail = rows.slice(0, 5).map((r) => r.id);
    pids.minus = rows[5]!.id;
    pids.plus = rows[6]!.id;
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
    for (let i = 0; i < 3; i++) oids.tail.push(await mk(i));
    oids.minus = await mk(10);
    oids.plus = await mk(11);
    for (const id of oids.tail) await setCreated('orders', id, TAIL);
    await setCreated('orders', oids.minus, MINUS);
    await setCreated('orders', oids.plus, PLUS);
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('products: межа gte/lt(createdAt, Date) повертає РІВНО рядки з міткою v', async () => {
    const rows = await productsOps.list({
      data: { subset: { filters: bound('createdAt') } },
    });
    expect(rows.map((r) => r.id).sort()).toEqual([...pids.tail].sort());
  });

  it('orders: межа gte/lt(createdAt, Date) повертає РІВНО рядки з міткою v', async () => {
    const rows = await ordersOps.list({
      data: { subset: { filters: bound('createdAt') } },
    });
    expect(rows.map((r) => r.id).sort()).toEqual([...oids.tail].sort());
  });

  it('products: повна пагінація createdAt desc, limit 3 — без дублів і втрат', async () => {
    const page = (offset: number) =>
      productsOps.list({
        data: {
          subset: {
            filters: [{ field: ['sectionId'], operator: 'eq', value: SECTION }],
            sorts: [{ field: ['createdAt'], direction: 'desc' }],
            limit: 3,
            ...(offset > 0 && { offset }),
          },
        },
      });
    const ids = (await Promise.all([page(0), page(3), page(6), page(9)]))
      .flat()
      .map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(7);
    // lt(createdAt, v) desc — «наступна сторінка» після межі: лише мітка MINUS.
    const after = await productsOps.list({
      data: {
        subset: {
          filters: [{ field: ['createdAt'], operator: 'lt', value: V }],
          sorts: [{ field: ['createdAt'], direction: 'desc' }],
        },
      },
    });
    expect(after.map((r) => r.id)).toEqual([pids.minus]);
  });

  it('контроль: in по sortable createdAt відхилено; Date в eq/in відхиляє схема', async () => {
    await expect(
      productsOps.list({
        data: {
          subset: {
            filters: [
              { field: ['createdAt'], operator: 'in', value: ['2026-01-01'] },
            ],
          },
        },
      }),
    ).rejects.toThrow(/createdAt/);
    const parse = (operator: string, value: unknown) =>
      subsetInputSchema.safeParse({
        subset: { filters: [{ field: ['createdAt'], operator, value }] },
      }).success;
    expect(parse('eq', V)).toBe(false);
    expect(parse('in', [V])).toBe(false);
  });

  it('non-Date курсор: eq(name, v) по sortable-колонці повертає рівно рядки з v', async () => {
    const rows = await productsOps.list({
      data: {
        subset: {
          filters: [{ field: ['name'], operator: 'eq', value: 'Альфа' }],
        },
      },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.name === 'Альфа')).toBe(true);
  });
});
