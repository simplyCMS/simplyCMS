import { describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { orders } from 'simplycms/schema';
import { toDrizzleSubset, type SubsetInput } from '../subset';

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

import { defineAdminResource } from '../resource';
import { ordersConfig } from './orders-config';

const dialect = new PgDialect();
const bad = (x: object) => x as unknown as SubsetInput;

describe('toDrizzleSubset: Date і sortable-колонки (курсор 0.11.3)', () => {
  const CURSOR = { filterable: ['statusId'], sortable: ['createdAt', 'total'] };
  const d = new Date('2026-01-01T00:00:00.123Z');
  const run = (operator: string, value: unknown, field: string) =>
    toDrizzleSubset(
      orders,
      CURSOR,
      bad({ filters: [{ field: [field], operator, value }] }),
    );

  it('(а) gte/lt з Date по sortable-but-not-filterable — проходять, обидва значення параметри', () => {
    const s = toDrizzleSubset(orders, CURSOR, {
      filters: [
        { field: ['createdAt'], operator: 'gte', value: d },
        {
          field: ['createdAt'],
          operator: 'lt',
          value: new Date(d.getTime() + 1),
        },
      ],
    });
    const compiled = dialect.sqlToQuery(s.where!);
    expect(compiled.sql).toMatch(/>= \$1/);
    expect(compiled.sql).toMatch(/< \$2/);
    expect(compiled.params).toHaveLength(2);
  });

  it('(б) in/isNull по sortable — кидає з колонкою й оператором; eq зі скаляром проходить', () => {
    expect(() => run('in', ['a'], 'total')).toThrow(/total.*in|in.*total/);
    expect(() => run('isNull', null, 'total')).toThrow(/isNull/);
    expect(() => run('eq', 5, 'total')).not.toThrow();
  });

  it('(в) колонка ні sortable, ні filterable — кидає і для eq, і для gt', () => {
    expect(() => run('gt', 1, 'subtotal')).toThrow(/subtotal/);
    expect(() => run('eq', 1, 'subtotal')).toThrow(/subtotal/);
  });

  it('(е) omit через справжній defineAdminResource: gt/eq/сорт по accessToken відхилено', async () => {
    const ops = defineAdminResource({
      ...ordersConfig,
      omit: ['accessToken'],
    });
    for (const operator of ['gt', 'eq'] as const) {
      await expect(
        ops.list({
          data: {
            subset: {
              filters: [{ field: ['accessToken'], operator, value: 'a' }],
            },
          },
        }),
      ).rejects.toThrow(/accessToken/);
    }
    await expect(
      ops.list({
        data: {
          subset: { sorts: [{ field: ['accessToken'], direction: 'asc' }] },
        },
      }),
    ).rejects.toThrow(/accessToken/);
    // Контроль: дозволена sortable-колонка проходить allowlist (далі впирається
    // лише в мок БД), тож відмова вище — саме від allowlist.
    await expect(
      ops.list({
        data: {
          subset: {
            filters: [{ field: ['createdAt'], operator: 'gt', value: d }],
          },
        },
      }),
    ).rejects.toThrow(/select is not a function/);
  });
});
