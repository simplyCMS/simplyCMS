import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { setResponseStatus } from '@tanstack/react-start/server';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
// Транзакцію підміняємо: перевіряємо виконавця, а не Postgres.
const actors: unknown[] = [];
// Хронологія подій: «commit» ставиться, коли колбек транзакції повернувся (як
// COMMIT у `withActor`), тож тест розрізняє «хвіст після коміту» і «усередині».
const events: string[] = [];
vi.mock('simplycms/db', async (orig) => ({
  ...(await orig<typeof import('simplycms/db')>()),
  withActor: vi.fn(async (actor: unknown, fn: (db: unknown) => unknown) => {
    actors.push(actor);
    const out = await fn({ fake: true });
    events.push('commit');
    return out;
  }),
}));
// Ключ ідемпотентності: поведінку резервування задає тест, SQL не потрібен.
const reserve = vi.hoisted(() => ({
  result: { kind: 'fresh' } as
    { kind: 'fresh' } | { kind: 'replay'; status: number; body: unknown },
}));
vi.mock('../http/idempotency', () => ({
  reserveIdempotencyKey: vi.fn(async () => reserve.result),
  storeIdempotentResponse: vi.fn(async () => undefined),
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
    events.length = 0;
    reserve.result = { kind: 'fresh' };
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

  const tailOp = (fail = false) =>
    defineOperation({
      id: 'test.tail',
      permission: 'settings.manage',
      input: z.object({ fail: z.boolean() }),
      output: z.object({ ok: z.boolean() }),
      idempotent: 'create',
      async run({ afterCommit }, input) {
        afterCommit(async () => {
          events.push('tail');
          if (fail) throw new Error('хвіст впав');
        });
        events.push('run');
        if (input.fail) throw new Error('відкат');
        return { ok: true };
      },
    });

  it('afterCommit: хвіст іде ПІСЛЯ коміту (не всередині транзакції), при відкаті — ніколи, збій хвоста не маскує відповідь', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const tail = tailOp(true);
      await expect(
        executeOperation(tail, { fail: true }, admin),
      ).rejects.toThrow('відкат');
      expect(events).toEqual(['run']);
      const ok = await executeOperation(tail, { fail: false }, admin);
      expect(ok).toEqual({ replayed: false, output: { ok: true } });
      // Порядок рівно run → commit → tail: хвіст до коміту дав би run, tail, commit.
      expect(events).toEqual(['run', 'run', 'commit', 'tail']);
    } finally {
      warn.mockRestore();
    }
  });

  it('replay ідемпотентного ключа: ні run, ні хвости вдруге не виконуються', async () => {
    const idempotency = {
      subjectKey: 'user:u1',
      key: 'k1',
      fingerprint: Buffer.from('x'),
    };
    const op = tailOp();
    const first = await executeOperation(op, { fail: false }, admin, {
      idempotency,
    });
    expect(first).toEqual({ replayed: false, output: { ok: true } });
    expect(events).toEqual(['run', 'commit', 'tail']);
    // Другий виклик: ключ уже збережено → replay.
    reserve.result = { kind: 'replay', status: 200, body: { ok: true } };
    events.length = 0;
    const again = await executeOperation(op, { fail: false }, admin, {
      idempotency,
    });
    expect(again).toEqual({ replayed: true, status: 200, body: { ok: true } });
    expect(events).toEqual(['commit']);
  });
});
