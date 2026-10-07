import { describe, expect, it, vi } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { orderStatuses } from 'simplycms/schema';

// Е6а-16: guard-хук фабрики. Порядок у транзакції — lock ПЕРШИМ запитом →
// guard над УСІМ пакетом → запис; без lock/guard — колишній шлях. БД —
// фейк, що пише журнал викликів (живий доказ — харнес admin-shipping*).
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: 'u1', roles: ['admin'] },
    scope: 'any',
  })),
}));
// Е6в-15: SQL локу — справжній `advisoryXactLock` з `simplycms/db`; фейк —
// лише транзакція (`withActor`).
vi.mock('simplycms/db', async (orig) => ({
  ...(await orig()),
  withActor: vi.fn(),
}));

import { withActor } from 'simplycms/db';
import { defineAdminResource } from '../resource';

const ID = '0e600000-0000-4000-8000-0000000000aa';
const ID2 = '0e600000-0000-4000-8000-0000000000bb';

/** Фейкова транзакція: кожен запит дописує крок у `log`. */
function fakeDb(log: string[], sqls: SQL[]) {
  const returning = (step: string) => async () => {
    log.push(step);
    return [{ id: ID }];
  };
  const db = {
    execute: vi.fn(async (q: SQL) => {
      sqls.push(q);
      log.push('lock');
    }),
    insert: () => ({ values: () => ({ returning: returning('insert') }) }),
    update: () => ({
      set: () => ({ where: () => ({ returning: returning('update') }) }),
    }),
  };
  vi.mocked(withActor).mockImplementation(async (_a, fn) =>
    fn(db as never, {} as never),
  );
}

const base = {
  entity: 'order_statuses',
  table: orderStatuses,
  operation: 'catalog.write',
  mode: 'eager',
  filterable: [],
  sortable: [],
  writable: ['name', 'code', 'color', 'sortOrder'],
  readonly: ['id', 'isDefault', 'createdAt'],
} as const;

const row = (id: string) => ({ id, name: 'X', code: 'x' });

describe('defineAdminResource: lock і guard (Е6а-16)', () => {
  it('insert: lock першим запитом → guard над усім пакетом → запис', async () => {
    const log: string[] = [];
    const sqls: SQL[] = [];
    fakeDb(log, sqls);
    const guard = vi.fn(async (_db: unknown, write: unknown) => {
      log.push('guard');
      expect(write).toEqual({ kind: 'insert', rows: [row(ID), row(ID2)] });
    });
    const ops = defineAdminResource({ ...base, lock: 'k-test', guard });
    await ops.insert({ data: [row(ID), row(ID2)] });
    expect(log).toEqual(['lock', 'guard', 'insert']);
    const q = new PgDialect().sqlToQuery(sqls[0]!);
    expect(q.sql).toContain('pg_advisory_xact_lock(hashtextextended(');
    expect(q.params).toEqual(['k-test']);
  });

  it('update: guard отримує всі { id, patch } пакета', async () => {
    const log: string[] = [];
    fakeDb(log, []);
    const guard = vi.fn(async () => {
      log.push('guard');
    });
    const ops = defineAdminResource({ ...base, lock: 'k', guard });
    const updates = [
      { id: ID, patch: { name: 'A' } },
      { id: ID2, patch: { sortOrder: 2 } },
    ];
    await ops.update({ data: updates });
    expect(guard).toHaveBeenCalledWith(expect.anything(), {
      kind: 'update',
      updates,
    });
    expect(log).toEqual(['lock', 'guard', 'update', 'update']);
  });

  it('guard кидає → запису немає, помилка летить як є', async () => {
    const log: string[] = [];
    fakeDb(log, []);
    const boom = new Error('guard відмовив');
    const ops = defineAdminResource({
      ...base,
      lock: 'k',
      guard: async () => {
        throw boom;
      },
    });
    await expect(ops.insert({ data: [row(ID)] })).rejects.toBe(boom);
    await expect(
      ops.update({ data: [{ id: ID, patch: { name: 'A' } }] }),
    ).rejects.toBe(boom);
    expect(log).toEqual(['lock', 'lock']);
  });

  it('без lock і guard — жодного зайвого запиту (поведінка незмінна)', async () => {
    const log: string[] = [];
    fakeDb(log, []);
    const ops = defineAdminResource(base);
    await ops.insert({ data: [row(ID)] });
    await ops.update({ data: [{ id: ID, patch: { name: 'A' } }] });
    expect(log).toEqual(['insert', 'update']);
  });
});
