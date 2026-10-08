// К3-Е6г, Task 5 (Е6г-4, Е6г-13): бан покупця з картки. Лок `admin-roles`
// доводиться детерміновано (holdAdvisoryLock/stillPending).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { holdAdvisoryLock, stillPending } from './fixtures/advisory-lock';
import * as F from './fixtures/customer-categories';

const grantAs = vi.hoisted(() => ({ id: '' }));
vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: grantAs.id, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { setCustomerBanOp } from 'simplycms/admin-server/impl';

describe('admin: бан покупця (Е6г-4/13)', () => {
  const db = F.useCustomersDb('simplycms_admin_ban');
  const url = () => db.url();

  const addSession = (userId: string) =>
    F.rows(
      url(),
      `insert into public.sessions (id, user_id, token, expires_at)
       values ($1, $2, $3, now() + interval '1 day')`,
      [crypto.randomUUID(), userId, crypto.randomUUID()],
    );
  const sessionCount = async (userId: string) =>
    Number(
      (
        await F.rows(
          url(),
          `select count(*) as n from public.sessions where user_id = $1`,
          [userId],
        )
      )[0]!.n,
    );
  const userRow = async (id: string) =>
    (
      await F.rows(
        url(),
        `select banned_at, ban_reason from public.users where id = $1`,
        [id],
      )
    )[0]!;
  const call = (userId: string, banned: boolean, reason?: string) => {
    grantAs.id = F.ADMIN_ID;
    return setCustomerBanOp({ data: { userId, banned, reason } });
  };
  afterEach(async () => {
    await F.rows(url(), `delete from public.user_roles where role = 'admin'`);
  });

  it('бан → сесії видалено, banned_at і причину записано; зняття очищає обидва', async () => {
    const id = await F.seedCustomer(url());
    await addSession(id);
    await addSession(id);
    const res = await call(id, true, '  спам  ');
    expect(res.bannedAt).toBeInstanceOf(Date);
    expect(await sessionCount(id)).toBe(0);
    const row = await userRow(id);
    expect(row.banned_at).not.toBeNull();
    expect(row.ban_reason).toBe('спам');
    await expect(call(id, false)).resolves.toEqual({ bannedAt: null });
    expect(await userRow(id)).toEqual({ banned_at: null, ban_reason: null });
  });

  it('адмін → customer_is_admin, сесії на місці, не забанений', async () => {
    const id = await F.seedCustomer(url());
    await F.rows(
      url(),
      `insert into public.user_roles (id, user_id, role) values ($1, $2, 'admin')`,
      [crypto.randomUUID(), id],
    );
    await addSession(id);
    await expect(call(id, true)).rejects.toMatchObject(
      F.conflict('state', 'customer_is_admin'),
    );
    expect(await sessionCount(id)).toBe(1);
    expect((await userRow(id)).banned_at).toBeNull();
  });

  it('стоїть, поки зовнішній тримає admin-roles; після release завершується', async () => {
    const id = await F.seedCustomer(url());
    const lock = await holdAdvisoryLock(url(), 'admin-roles');
    try {
      const op = call(id, true);
      op.catch(() => {});
      expect(await stillPending(op, 300)).toBe(true);
      expect((await userRow(id)).banned_at).toBeNull();
      await lock.release();
      await expect(op).resolves.toMatchObject({ bannedAt: expect.any(Date) });
    } finally {
      await lock.cleanup();
    }
  });
});
