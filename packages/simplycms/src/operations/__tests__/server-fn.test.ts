// Карта «доменна помилка → статус відповіді» на межі serverFn (І14: 412 проти
// 409 — контракт). Кожна стрілка має власний кейс.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { setResponseStatus } from '@tanstack/react-start/server';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig<typeof import('simplycms/auth')>()),
  subjectFromCookie: vi.fn(async () => ({ userId: 'u1', roles: ['admin'] })),
}));
vi.mock('simplycms/db', async (orig) => ({
  ...(await orig<typeof import('simplycms/db')>()),
  withActor: vi.fn(async (_a: unknown, fn: (db: unknown) => unknown) => fn({})),
}));

import { AuthzError } from 'simplycms/auth';
import {
  AdminConflictError,
  AdminNotFoundError,
  InUseError,
  SourceChangedError,
  ValidationError,
  VersionMismatchError,
} from 'simplycms/contracts/domain-errors';
import { defineOperation } from '..';
import { invokeFromServerFn, passThrough } from '../server';

let thrown: Error | null = null;
const op = defineOperation({
  id: 'test.throws',
  permission: 'settings.manage',
  input: z.object({}),
  output: z.object({ ok: z.boolean() }),
  async run() {
    if (thrown) throw thrown;
    return { ok: true };
  },
});

describe('invokeFromServerFn: статус відповіді', () => {
  beforeEach(() => {
    thrown = null;
    vi.mocked(setResponseStatus).mockClear();
  });

  it.each([
    {
      name: 'AuthzError',
      error: new AuthzError('settings.manage'),
      status: 403,
    },
    { name: 'ValidationError', error: new ValidationError([]), status: 400 },
    {
      name: 'AdminConflictError',
      error: new AdminConflictError('unique', 'k'),
      status: 409,
    },
    {
      name: 'InUseError',
      error: new InUseError('language_in_use'),
      status: 409,
    },
    {
      name: 'SourceChangedError',
      error: new SourceChangedError('en', {}),
      status: 409,
    },
    {
      name: 'VersionMismatchError',
      error: new VersionMismatchError(3),
      status: 412,
    },
    {
      name: 'AdminNotFoundError',
      error: new AdminNotFoundError('мова'),
      status: 404,
    },
  ])('$name → $status', async ({ error, status }) => {
    thrown = error;
    await expect(invokeFromServerFn(op, {})).rejects.toBe(error);
    expect(setResponseStatus).toHaveBeenCalledExactlyOnceWith(status);
  });

  it('невідома помилка статусу не ставить (лишається 500 межі)', async () => {
    thrown = new Error('збій');
    await expect(invokeFromServerFn(op, {})).rejects.toThrow('збій');
    expect(setResponseStatus).not.toHaveBeenCalled();
  });

  it('успіх: статус не ставиться, passThrough повертає вхід як є', async () => {
    expect(await invokeFromServerFn(op, {})).toEqual({ ok: true });
    expect(setResponseStatus).not.toHaveBeenCalled();
    const input = { a: 1 };
    expect(passThrough(input)).toBe(input);
  });

  it('відмова права ловиться до run: scopes без id → 403', async () => {
    const { subjectFromCookie } = await import('simplycms/auth');
    vi.mocked(subjectFromCookie).mockResolvedValueOnce({
      userId: 'u1',
      roles: ['user'],
    });
    await expect(invokeFromServerFn(op, {})).rejects.toBeInstanceOf(AuthzError);
    expect(setResponseStatus).toHaveBeenCalledExactlyOnceWith(403);
  });
});
