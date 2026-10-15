// І14: порядок перевірок права → валідація → версія → хеш джерела.
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('simplycms/db', async (orig) => ({
  ...(await orig<typeof import('simplycms/db')>()),
  withActor: vi.fn(async (_a: unknown, fn: (db: unknown) => unknown) => fn({})),
}));

import { AuthzError } from 'simplycms/auth';
import {
  SourceChangedError,
  VersionMismatchError,
} from 'simplycms/contracts/domain-errors';
import { assertVersionThenHash, defineOperation, executeOperation } from '..';

// Фейкова команда агрегата: версія в БД — 5, хеш джерела розходиться.
const command = defineOperation({
  id: 'test.command',
  permission: 'catalog.write',
  input: z.object({
    expectedVersion: z.number().int().optional(),
    title: z.string().min(1),
  }),
  output: z.object({ ok: z.boolean() }),
  async run(_ctx, input) {
    assertVersionThenHash(5, input.expectedVersion, () => {
      throw new SourceChangedError('en', { name: 'новий-хеш' });
    });
    return { ok: true };
  },
});
const admin = { userId: 'u1', roles: ['admin' as const] };

describe('порядок перевірок виконавця (І14)', () => {
  it('без права й невалідний одночасно → AuthzError', async () => {
    await expect(
      executeOperation(
        command,
        { title: '' },
        { userId: 'u', roles: ['user'] },
      ),
    ).rejects.toBeInstanceOf(AuthzError);
  });

  it('валідний, версія і хеш розійшлись → VersionMismatchError (пріоритет над SourceChangedError)', async () => {
    const err = await executeOperation(
      command,
      { title: 'x', expectedVersion: 4 },
      admin,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(VersionMismatchError);
    expect((err as VersionMismatchError).currentVersion).toBe(5);
  });

  it('версія збіглась, хеш ні → SourceChangedError', async () => {
    await expect(
      executeOperation(command, { title: 'x', expectedVersion: 5 }, admin),
    ).rejects.toBeInstanceOf(SourceChangedError);
  });
});
