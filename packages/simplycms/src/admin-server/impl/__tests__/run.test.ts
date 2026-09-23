// Е3-7/К3-13: одна склейка grant → роль → транзакція для admin-server, і
// мапінг конфліктів БД (23505/23503) у AdminConflictError + 409 ДО throw.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const grant = vi.hoisted(() => ({
  value: { subject: { userId: 'u1', roles: ['admin'] }, scope: 'any' } as {
    subject: { userId: string | null; roles: string[] };
    scope: 'any' | 'own';
  },
}));
const status = vi.hoisted(() => ({ set: vi.fn() }));

vi.mock('simplycms/auth', () => ({
  requireGrant: vi.fn(async () => grant.value),
  dbRoleForSubject: () => 'app_admin',
}));
vi.mock('simplycms/db', () => ({
  withActor: vi.fn(async (_a: unknown, fn: (db: unknown) => unknown) => fn({})),
}));
vi.mock('@tanstack/react-start/server', () => ({
  setResponseStatus: status.set,
}));

import { runAdmin } from '../run';
import { AdminConflictError } from '../errors';

const pgError = (code: string, constraint: string) =>
  Object.assign(new Error('Failed query: insert …'), {
    cause: Object.assign(new Error('duplicate key'), { code, constraint }),
  });

describe('runAdmin', () => {
  beforeEach(() => {
    grant.value = { subject: { userId: 'u1', roles: ['admin'] }, scope: 'any' };
    status.set.mockClear();
  });

  it('scope own — fail-loud (адмін-поверхня обслуговує лише any)', async () => {
    grant.value = { ...grant.value, scope: 'own' };
    await expect(runAdmin('catalog.write', async () => 1)).rejects.toThrow(
      /scope 'own'/,
    );
  });

  it('23505 → AdminConflictError unique + 409 ДО throw', async () => {
    const err = await runAdmin('catalog.write', async () => {
      throw pgError('23505', 'products_slug_key');
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdminConflictError);
    expect(err).toMatchObject({
      name: 'AdminConflictError',
      kind: 'unique',
      constraint: 'products_slug_key',
    });
    expect(status.set).toHaveBeenCalledWith(409);
  });

  it('23503 → kind reference', async () => {
    const err = await runAdmin('catalog.write', async () => {
      throw pgError('23503', 'order_items_product_id_fkey');
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({
      kind: 'reference',
      constraint: 'order_items_product_id_fkey',
    });
  });

  it('інша помилка БД проходить без змін і без статусу', async () => {
    const original = pgError('22P02', 'x');
    await expect(
      runAdmin('catalog.write', async () => {
        throw original;
      }),
    ).rejects.toBe(original);
    expect(status.set).not.toHaveBeenCalled();
  });

  it('userId субʼєкта передається в withActor', async () => {
    const { withActor } = await import('simplycms/db');
    await runAdmin('catalog.write', async () => null);
    expect(withActor).toHaveBeenLastCalledWith(
      { role: 'app_admin', userId: 'u1' },
      expect.any(Function),
    );
  });
});
