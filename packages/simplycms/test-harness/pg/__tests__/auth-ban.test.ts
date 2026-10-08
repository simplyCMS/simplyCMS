// К3-Е6г, Task 5 (Е6г-13, Review Focus 4): бан на реальній БД через
// `createAuth` без підмін: хук читає `users.banned_at`, тригер стоїть позаду.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAuth } from 'simplycms/auth';
import { closeDbPool } from 'simplycms/db';
import * as F from './fixtures/customer-categories';

vi.mock('@tanstack/react-start/server', () => ({ setResponseStatus: vi.fn() }));
vi.mock('simplycms/auth', async (orig) => ({
  ...(await orig()),
  requireGrant: vi.fn(async () => ({
    subject: { userId: F.ADMIN_ID, roles: ['admin'] },
    scope: 'any',
  })),
}));

import { setCustomerBanOp } from 'simplycms/admin-server/impl';

const PASSWORD = 'super-secret-password';

describe('Better Auth: бан на реальній БД (Е6г-13)', () => {
  const db = F.useCustomersDb('simplycms_auth_ban');
  const url = () => db.url();
  let auth: ReturnType<typeof createAuth>;
  beforeAll(() => {
    auth = createAuth({
      secret: 'integration-secret-not-a-real-one',
      baseURL: 'http://localhost:3000',
    });
  });
  afterAll(() => closeDbPool());

  const cookieOf = (r: Response) =>
    r.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
  const signIn = (email: string) =>
    auth.api.signInEmail({
      body: { email, password: PASSWORD },
      asResponse: true,
    });
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

  it('забанений: вхід 403 BANNED без сесії; скидання пароля проходить без сесії, вхід далі BANNED; зняття — 200', async () => {
    const email = 'banned-buyer@example.test';
    const up = await auth.api.signUpEmail({
      body: { email, password: PASSWORD, name: 'Покупець Бан' },
      asResponse: true,
    });
    expect(up.status).toBe(200);
    const oldCookie = cookieOf(up);
    const id = String(
      (
        await F.rows(url(), `select id from public.users where email = $1`, [
          email,
        ])
      )[0]!.id,
    );
    expect(await sessionCount(id)).toBe(1);

    await setCustomerBanOp({ data: { userId: id, banned: true } });
    // Стара cookie: сесії в БД немає → getSession дає null, а не 500.
    expect(
      await auth.api.getSession({
        headers: new Headers({ cookie: oldCookie }),
      }),
    ).toBeNull();

    const denied = await signIn(email);
    expect(denied.status).toBe(403);
    expect(await denied.json()).toMatchObject({ code: 'BANNED' });
    expect(await sessionCount(id)).toBe(0);

    // Review Focus 4: скидання пароля за посиланням з листа.
    await auth.api.requestPasswordReset({ body: { email } });
    const identifier = String(
      (
        await F.rows(
          url(),
          `select identifier from public.verifications where identifier like 'reset-password:%' and value = $1`,
          [id],
        )
      )[0]!.identifier,
    );
    const reset = await auth.api.resetPassword({
      body: {
        newPassword: 'another-secret-password',
        token: identifier.slice(15),
      },
      asResponse: true,
    });
    expect(reset.status).toBe(200);
    expect(await sessionCount(id)).toBe(0);
    const again = await auth.api.signInEmail({
      body: { email, password: 'another-secret-password' },
      asResponse: true,
    });
    expect(again.status).toBe(403);
    expect(await again.json()).toMatchObject({ code: 'BANNED' });

    await setCustomerBanOp({ data: { userId: id, banned: false } });
    const ok = await auth.api.signInEmail({
      body: { email, password: 'another-secret-password' },
      asResponse: true,
    });
    expect(ok.status).toBe(200);
    expect(await sessionCount(id)).toBe(1);
  });
});
