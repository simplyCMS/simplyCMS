import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { setResponseStatus } from '@tanstack/react-start/server';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
// Транзакцію підміняємо: перевіряємо виконавця, а не Postgres.
const actors: unknown[] = [];
vi.mock('simplycms/db', async (orig) => ({
  ...(await orig<typeof import('simplycms/db')>()),
  withActor: vi.fn(async (actor: unknown, fn: (db: unknown) => unknown) => {
    actors.push(actor);
    return fn({ fake: true });
  }),
}));

import { AuthzError } from 'simplycms/auth';
import { ValidationError } from 'simplycms/contracts/domain-errors';
import { defineOperation, executeOperation } from '..';

const admin = { userId: 'u1', roles: ['admin' as const] };
const run = vi.fn(async (_ctx: unknown, input: { n: number }) => ({
  n: input.n,
}));
const op = defineOperation({
  id: 'test.double',
  permission: 'settings.manage',
  input: z.object({ n: z.number().int() }),
  output: z.object({ n: z.number() }),
  run,
});

describe('executeOperation', () => {
  beforeEach(() => {
    run.mockClear();
    actors.length = 0;
    vi.mocked(setResponseStatus).mockClear();
  });

  it('невалідний вхід → ValidationError з path/code, без сирого значення', async () => {
    const err = await executeOperation(op, { n: 'секрет-ввід' }, admin).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ValidationError);
    const issues = (err as ValidationError).issues;
    expect(issues[0]).toMatchObject({ path: ['n'], code: 'invalid_type' });
    expect(JSON.stringify(issues)).not.toContain('секрет-ввід');
    expect(run).not.toHaveBeenCalled();
  });

  it('роль без права → AuthzError', async () => {
    await expect(
      executeOperation(op, { n: 1 }, { userId: 'u2', roles: ['user'] }),
    ).rejects.toBeInstanceOf(AuthzError);
    expect(run).not.toHaveBeenCalled();
  });

  it('scopes без id операції → AuthzError', async () => {
    await expect(
      executeOperation(op, { n: 1 }, { ...admin, scopes: ['languages.add'] }),
    ).rejects.toBeInstanceOf(AuthzError);
  });

  it('scopes з id → виконано під актором суб’єкта', async () => {
    const res = await executeOperation(
      op,
      { n: 2 },
      { ...admin, scopes: ['test.double'] },
    );
    expect(res).toEqual({ replayed: false, output: { n: 2 } });
    expect(actors[0]).toEqual({ role: 'app_admin', userId: 'u1' });
    expect(run.mock.calls[0]![0]).toMatchObject({
      actor: { kind: 'admin', userId: 'u1' },
    });
  });

  it('помилка БД 23505 → AdminConflictError', async () => {
    run.mockRejectedValueOnce(
      Object.assign(new Error('Failed query'), {
        cause: { code: '23505', constraint: 'x_key' },
      }),
    );
    await expect(executeOperation(op, { n: 1 }, admin)).rejects.toMatchObject({
      name: 'AdminConflictError',
      kind: 'unique',
      constraint: 'x_key',
    });
  });

  it('статус відповіді виконавець не ставить', async () => {
    await executeOperation(op, { n: 1 }, admin);
    await executeOperation(op, { n: 'x' }, admin).catch(() => undefined);
    await executeOperation(op, { n: 1 }, { userId: null, roles: [] }).catch(
      () => undefined,
    );
    expect(setResponseStatus).not.toHaveBeenCalled();
  });

  it('некоректний id операції відхиляється при визначенні', () => {
    expect(() => defineOperation({ ...op, id: 'Bad_ID' })).toThrow(
      /id операції має формат/,
    );
  });
});
