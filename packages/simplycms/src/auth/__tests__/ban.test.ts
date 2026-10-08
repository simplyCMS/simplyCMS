import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuthClient } from 'better-auth/client';
import { describe, expect, it } from 'vitest';
import { createSessionBanHook } from '../ban';
import { createAuth } from '../instance';

// Е6г-13: бан у хуку `session.create.before`. Доказ іде через РЕАЛЬНИЙ
// `auth.handler` (HTTP-межа), бо те, що `better-call` донесе код `BANNED` до
// клієнта, не доводиться читанням коду: `false` із хука дало б загальний
// `FAILED_TO_CREATE_SESSION`.

const BASE = 'http://localhost:3000';
const EMAIL = 'buyer@example.test';
const PASSWORD = 'super-secret-password';

function setup() {
  const state = { banned: false };
  const auth = createAuth({
    database: memoryAdapter({
      user: [],
      session: [],
      account: [],
      verification: [],
    }),
    secret: 'test-secret-not-a-real-one',
    baseURL: BASE,
    provisionUser: async () => {},
    isUserBanned: async () => state.banned,
  });
  const signIn = () =>
    auth.handler(
      new Request(`${BASE}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: BASE },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      }),
    );
  const signUp = () =>
    auth.api.signUpEmail({
      body: { email: EMAIL, password: PASSWORD, name: 'Покупець' },
      asResponse: true,
    });
  return { auth, state, signIn, signUp };
}

describe('бан у session.create.before (Е6г-13)', () => {
  it('createSessionBanHook: забанений → FORBIDDEN/BANNED; незабанений → без винятку', async () => {
    await expect(
      createSessionBanHook(async () => true)({ userId: 'u' }),
    ).rejects.toMatchObject({
      status: 'FORBIDDEN',
      body: { code: 'BANNED', message: 'Account is banned' },
    });
    await expect(
      createSessionBanHook(async () => false)({ userId: 'u' }),
    ).resolves.toBeUndefined();
  });

  it('auth.handler: забанений вхід → 403 і code BANNED у тілі', async () => {
    const ctx = setup();
    expect((await ctx.signUp()).status).toBe(200);
    ctx.state.banned = true;
    const response = await ctx.signIn();
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'BANNED' });
  });

  it('authClient: error.code === BANNED', async () => {
    const ctx = setup();
    await ctx.signUp();
    ctx.state.banned = true;
    const client = createAuthClient({
      baseURL: BASE,
      fetchOptions: {
        customFetchImpl: (url, init) =>
          ctx.auth.handler(new Request(url, init)),
      },
    });
    const { error } = await client.signIn.email({
      email: EMAIL,
      password: PASSWORD,
    });
    expect(error?.code).toBe('BANNED');
  });

  it('незабанений вхід → 200', async () => {
    const ctx = setup();
    await ctx.signUp();
    expect((await ctx.signIn()).status).toBe(200);
  });
});
