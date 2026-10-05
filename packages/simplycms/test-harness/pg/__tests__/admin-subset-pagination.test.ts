// Курсор subset проти живої БД: повна пагінація, non-Date курсор eq(name),
// контрольні відмови. Сід — fixtures/subset-cursor.ts.
import { subsetInputSchema } from '../../../src/admin-server/impl/subset';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  dropCursorDb,
  seedCursorDb,
  SECTION,
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

import { productsOps } from 'simplycms/admin-server/impl';

describe('admin: пагінація і non-Date курсор subset', () => {
  let db: CursorDb;
  beforeAll(async () => {
    db = await seedCursorDb();
  }, 120_000);
  afterAll(() => dropCursorDb(db));

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
