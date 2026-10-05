// Курсор «Показати ще» @tanstack/db 0.11.3 проти живої БД: межа сторінки
// Date-курсора (gte/lt) на реальних productsOps.list і ordersOps.list.
// Сід — fixtures/subset-cursor.ts.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  bound,
  dropCursorDb,
  seedCursorDb,
  V,
  type CursorDb,
} from './fixtures/subset-cursor';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: null, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { ordersOps, productsOps } from 'simplycms/admin-server/impl';

describe('admin: межа Date-курсора subset', () => {
  let db: CursorDb;
  beforeAll(async () => {
    db = await seedCursorDb();
  }, 120_000);
  afterAll(() => dropCursorDb(db));

  it('products: межа gte/lt(createdAt, Date) повертає РІВНО рядки з міткою v', async () => {
    const rows = await productsOps.list({
      data: { subset: { filters: bound('createdAt') } },
    });
    expect(rows.map((r) => r.id).sort()).toEqual([...db.pids.tail].sort());
  });

  it('orders: межа gte/lt(createdAt, Date) повертає РІВНО рядки з міткою v', async () => {
    const rows = await ordersOps.list({
      data: { subset: { filters: bound('createdAt') } },
    });
    expect(rows.map((r) => r.id).sort()).toEqual([...db.oids.tail].sort());
  });

  it('products: lt(createdAt, v) desc — наступна сторінка після межі', async () => {
    const after = await productsOps.list({
      data: {
        subset: {
          filters: [{ field: ['createdAt'], operator: 'lt', value: V }],
          sorts: [{ field: ['createdAt'], direction: 'desc' }],
        },
      },
    });
    expect(after.map((r) => r.id)).toEqual([db.pids.minus]);
  });
});
