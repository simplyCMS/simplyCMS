// К3-Е6г, Task 6 (Е6г-2, Е6г-18): скидання пароля на реальному `auth.handler`.
// Guard доводиться детерміновано: окремий клієнт тримає незакомічену зміну
// `users`, `pg_blocking_pids` показує, що чекає саме `FOR SHARE` guard-а.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAuth } from 'simplycms/auth';
import { closeDbPool } from 'simplycms/db';
import { holdRowLock, stillPending } from './fixtures/advisory-lock';
import * as F from './fixtures/customer-categories';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { updateCustomerContactsOp } from 'simplycms/admin-server/impl';

describe('скидання пароля: guard і відкликання токенів (Е6г-2/18)', () => {
  const db = F.useCustomersDb('simplycms_reset_guard');
  const url = () => db.url();
  const sendEmail = vi.fn(async () => {});
  let auth: ReturnType<typeof createAuth>;
  beforeAll(() => {
    auth = createAuth({
      secret: 'integration-secret-not-a-real-one',
      baseURL: 'http://localhost:3000',
      sendEmail,
    });
  });
  afterAll(() => closeDbPool());

  const resetTokens = async (userId: string) =>
    F.rows(
      url(),
      `select identifier from public.verifications
       where identifier like 'reset-password:%' and value = $1`,
      [userId],
    );
  const waitingGuard = async (pid: number) =>
    Number(
      (
        await F.rows(
          url(),
          `select count(*) as n from pg_stat_activity
           where $1 = any(pg_blocking_pids(pid))
             and query ilike '%"users"%' and query ilike '%for share%'`,
          [pid],
        )
      )[0]!.n,
    );

  it('наскрізно: токен до зміни email не скидає пароль (INVALID_TOKEN)', async () => {
    const id = await F.seedCustomer(url(), { email: 'flow@x.test' });
    await auth.api.requestPasswordReset({ body: { email: 'flow@x.test' } });
    const [row] = await resetTokens(id);
    const old = String(row!.identifier).slice('reset-password:'.length);
    await updateCustomerContactsOp({
      data: {
        userId: id,
        firstName: 'Іван',
        lastName: null,
        phone: null,
        email: 'flow2@x.test',
      },
    });
    await expect(
      auth.api.resetPassword({
        body: { newPassword: 'another-secret-password', token: old },
      }),
    ).rejects.toMatchObject({ body: { code: 'INVALID_TOKEN' } });
  });

  it.each([
    ['update users set email = $2 where id = $1', ['new@x.test']],
    ['delete from public.users where id = $1', []],
  ])('конкурент (%s) → токена немає, листа немає', async (sql, extra) => {
    const email = `guard-${extra.length}@x.test`;
    const id = await F.seedCustomer(url(), { email });
    await F.rows(url(), `delete from public.profiles where user_id = $1`, [id]);
    sendEmail.mockClear();
    const lock = await holdRowLock(
      url(),
      'select id from public.users where id = $1 for update',
      [id],
    );
    try {
      await lock.query(sql, [id, ...extra]);
      const req = auth.api.requestPasswordReset({ body: { email } });
      req.catch(() => {});
      expect(await stillPending(req, 500)).toBe(true);
      expect(await waitingGuard(lock.pid)).toBe(1);
      await lock.release();
      await req;
    } finally {
      await lock.cleanup();
    }
    expect(await resetTokens(id)).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('без конкурента: токен є, лист пішов', async () => {
    const id = await F.seedCustomer(url(), { email: 'calm@x.test' });
    sendEmail.mockClear();
    await auth.api.requestPasswordReset({ body: { email: 'calm@x.test' } });
    expect(await resetTokens(id)).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
