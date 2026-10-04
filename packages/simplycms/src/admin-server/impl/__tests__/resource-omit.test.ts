import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { orders } from 'simplycms/schema';

// Е5-7 / Е5-12: `omit` і `maxLimit` фабрики ресурсу. Окремий файл, бо
// `resource.test.ts` уже понад ліміт розміру; моки — ті самі канали.
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: 'u1', roles: ['admin'] },
    scope: 'any',
  })),
}));
vi.mock('simplycms/db', () => ({
  withActor: vi.fn(async (_actor, fn) => fn({} as never, {} as never)),
}));

import { defineAdminResource, pickColumns } from '../resource';
import {
  ordersConfig,
  ORDERS_WRITABLE,
  ORDERS_READONLY,
} from './orders-config';

const ops = defineAdminResource({ ...ordersConfig, omit: ['accessToken'] });

/** Ланцюг `select → from → $dynamic → …` зі шпигуном на `limit` і `select`. */
async function captureList(
  target: { list: typeof ops.list },
  subset: Record<string, unknown>,
) {
  const limit = vi.fn(function (this: unknown, ..._n: unknown[]) {
    return this;
  });
  const select = vi.fn((..._f: unknown[]) => ({
    from: () => ({ $dynamic: () => q }),
  }));
  const q = {
    where: () => q,
    orderBy: () => q,
    limit,
    offset: () => q,
    then: (r: (v: unknown[]) => unknown) => r([]),
  };
  const { withActor } = await import('simplycms/db');
  vi.mocked(withActor).mockImplementationOnce(async (_a, fn) =>
    fn({ select } as never, {} as never),
  );
  await target.list({ data: { subset } });
  return { limit, select };
}

describe('omit (Е5-7)', () => {
  it('pickColumns(orders, [accessToken]) не містить accessToken, містить решту', () => {
    const picked = pickColumns(orders, ['accessToken']);
    expect('accessToken' in picked).toBe(false);
    const rest = Object.keys(getTableColumns(orders)).filter(
      (k) => k !== 'accessToken',
    );
    expect(Object.keys(picked).sort()).toEqual(rest.sort());
    expect(picked['id']).toBe(orders.id);
  });

  it('pickColumns без omit — усі колонки таблиці', () => {
    expect(Object.keys(pickColumns(orders, []))).toEqual(
      Object.keys(getTableColumns(orders)),
    );
  });

  it('rowSchema не має accessToken', () => {
    expect('accessToken' in ops.rowSchema.shape).toBe(false);
    expect('orderNumber' in ops.rowSchema.shape).toBe(true);
  });

  it('list: SELECT іде явною проєкцією без accessToken', async () => {
    const { select } = await captureList(ops, {});
    const fields = select.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(fields).toBeDefined();
    expect('accessToken' in fields).toBe(false);
    expect('orderNumber' in fields).toBe(true);
  });

  it('статично: рядок list не має accessToken', () => {
    type Row = Awaited<ReturnType<typeof ops.list>>[number];
    expectTypeOf<Row>().not.toHaveProperty('accessToken');
    expectTypeOf<Row>().toHaveProperty('orderNumber');
  });

  it('негативні контролі типів: omit перетинається зі списками або колонку пропущено', () => {
    // accessToken і в omit, і в readonly → __overlappingColumns.
    // @ts-expect-error — accessToken у omit І readonly
    defineAdminResource({
      ...ordersConfig,
      readonly: [...ORDERS_READONLY, 'accessToken'],
      omit: ['accessToken'],
    });
    // accessToken і в omit, і в writable → __overlappingColumns.
    // @ts-expect-error — accessToken у omit І writable
    defineAdminResource({
      ...ordersConfig,
      writable: [...ORDERS_WRITABLE, 'accessToken'],
      omit: ['accessToken'],
    });
    // accessToken не в жодному списку → __missingColumns.
    // @ts-expect-error — accessToken не покритий
    defineAdminResource(ordersConfig);
    // Фільтр за прихованою колонкою — оракул секрету, заборонено типом.
    defineAdminResource({
      ...ordersConfig,
      // @ts-expect-error — accessToken прихований, фільтрувати ним не можна
      filterable: ['accessToken'],
      omit: ['accessToken'],
    });
  });
});

describe('maxLimit (Е5-12)', () => {
  const capped = defineAdminResource({
    ...ordersConfig,
    omit: ['accessToken'],
    maxLimit: 100,
  });

  it('subset без limit → застосовано maxLimit', async () => {
    const { limit } = await captureList(capped, {});
    expect(limit).toHaveBeenCalledWith(100);
  });

  it('limit більший за maxLimit → обрізано; менший — як є', async () => {
    expect(
      (await captureList(capped, { limit: 500 })).limit,
    ).toHaveBeenCalledWith(100);
    expect(
      (await captureList(capped, { limit: 20 })).limit,
    ).toHaveBeenCalledWith(20);
  });

  it('без maxLimit поведінка незмінна: немає limit — немає LIMIT', async () => {
    expect((await captureList(ops, {})).limit).not.toHaveBeenCalled();
    expect((await captureList(ops, { limit: 500 })).limit).toHaveBeenCalledWith(
      500,
    );
  });
});
