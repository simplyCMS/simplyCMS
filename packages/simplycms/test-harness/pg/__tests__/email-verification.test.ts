// К3-Е8, Task 12b (Р30): підтвердження пошти при реєстрації зі SMTP — наскрізь
// проти справжньої БД. Закриває pre-hijack (чужу пошту займали до власника).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acceptOwnerInvite,
  createAuth,
  issueOwnerInvite,
  ownerInviteStore,
} from 'simplycms/auth';
import { closeDbPool } from 'simplycms/db';
import type { MailMessage, MailTransport } from 'simplycms/mail';
import { declareStoreLocale } from 'simplycms/site';
import * as F from './fixtures/customer-categories';

const SITE = 'https://shop.example';
const PASSWORD = 'verify-password-not-a-real-one';
const SECRET = 'integration-secret-not-a-real-one';

describe('підтвердження пошти при реєстрації (Р30)', () => {
  const db = F.useCustomersDb('simplycms_email_verify');
  const url = () => db.url();
  const sent: MailMessage[] = [];
  const transport: MailTransport = {
    driver: 'smtp',
    send: async (m) => {
      sent.push(m);
    },
  };
  // baseURL НЕ передано, `requireEmailVerification` теж: обидва беруться з env.
  let auth: ReturnType<typeof createAuth>;

  const waitFor = async (cond: () => boolean) => {
    for (let i = 0; i < 100 && !cond(); i++)
      await new Promise((r) => setTimeout(r, 30));
    if (!cond()) throw new Error('waitFor: умова не виконалась');
  };
  const post = (
    path: string,
    body: unknown,
    headers: HeadersInit = {},
    origin = SITE,
  ) =>
    auth.handler(
      new Request(`${origin}/api/auth/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      }),
    );
  const signUp = (email: string, headers: HeadersInit = {}, origin = SITE) =>
    post(
      'sign-up/email',
      { email, password: PASSWORD, name: 'Іван Тест' },
      headers,
      origin,
    );
  const signIn = (email: string) =>
    post('sign-in/email', { email, password: PASSWORD });
  const verified = async (email: string) =>
    (
      (await F.rows(
        url(),
        `select email_verified from public.users where email = $1`,
        [email],
      )) as { email_verified: boolean }[]
    )[0]?.email_verified;
  const linkOf = (m: MailMessage) => /https?:\/\/\S+/.exec(m.text)![0];

  beforeAll(() => {
    declareStoreLocale('uk');
    process.env.VITE_SITE_URL = SITE;
    process.env.SMTP_URL = 'smtp://127.0.0.1:1';
    process.env.MAIL_FROM = 'shop@shop.example';
    auth = createAuth({ secret: SECRET, mailTransport: transport });
  });
  afterAll(async () => {
    for (const key of ['VITE_SITE_URL', 'SMTP_URL', 'MAIL_FROM'])
      delete process.env[key];
    await closeDbPool();
  });

  it('signUp зі SMTP: без сесії, лист email_verification, посилання від VITE_SITE_URL попри X-Forwarded-Host; вхід до переходу — 403; перехід підтверджує; вхід після — сесія', async () => {
    sent.length = 0;
    const email = 'verify-ok@x.test';
    // URL запиту — чужий хост: без бази з env BA взяв би її саме звідти.
    const response = await signUp(
      email,
      { host: 'evil.example', 'x-forwarded-host': 'evil.example' },
      'http://evil.example',
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect(((await response.json()) as { token: unknown }).token).toBeNull();
    expect(response.headers.getSetCookie()).toHaveLength(0);
    await waitFor(() => sent.length === 1);
    expect(sent[0]!.kind).toBe('email_verification');
    expect(sent[0]!.to).toBe(email);
    const link = linkOf(sent[0]!);
    expect(link.startsWith(`${SITE}/api/auth/verify-email?token=`)).toBe(true);
    expect(sent[0]!.text).not.toContain('evil.example');
    expect(sent[0]!.html).not.toContain('evil.example');

    const before = await signIn(email);
    expect(before.status).toBe(403);
    expect(((await before.json()) as { code: string }).code).toBe(
      'EMAIL_NOT_VERIFIED',
    );
    expect(await verified(email)).toBe(false);

    const click = await auth.handler(new Request(link));
    expect([200, 302]).toContain(click.status);
    expect(await verified(email)).toBe(true);

    const after = await signIn(email);
    expect(after.status, await after.clone().text()).toBe(200);
    expect(after.headers.getSetCookie().length).toBeGreaterThan(0);
  }, 20_000);

  it('sendOnSignIn: непідтверджений акаунт на вході — 403 і новий лист email_verification', async () => {
    const email = 'verify-signin@x.test';
    await signUp(email);
    await waitFor(() => sent.some((m) => m.to === email));
    sent.length = 0;
    const response = await signIn(email);
    expect(response.status).toBe(403);
    await waitFor(() => sent.length === 1);
    expect(sent[0]!.kind).toBe('email_verification');
    expect(sent[0]!.to).toBe(email);
  });

  it('owner:invite -> accept -> вхід без окремого листа підтвердження (emailVerified = true)', async () => {
    sent.length = 0;
    const letters: MailMessage[] = [];
    const invite = await issueOwnerInvite({
      store: ownerInviteStore,
      schedule: async (items) => {
        letters.push(...items.map((item) => item.message));
        return [];
      },
      email: 'owner-p30@x.test',
      env: { VITE_SITE_URL: SITE },
    });
    const accepted = await acceptOwnerInvite({
      auth,
      store: ownerInviteStore,
      email: 'owner-p30@x.test',
      token: new URL(invite.url).searchParams.get('token')!,
      password: PASSWORD,
    });
    expect(accepted.ok).toBe(true);
    expect(await verified('owner-p30@x.test')).toBe(true);
    const response = await signIn('owner-p30@x.test');
    expect(response.status, await response.clone().text()).toBe(200);
    expect(sent).toHaveLength(0);
  }, 20_000);

  it('непідтверджений покупець: requestPasswordReset -> resetPassword за посиланням -> emailVerified = true, вхід успішний', async () => {
    const email = 'verify-reset@x.test';
    await signUp(email);
    await waitFor(() => sent.some((m) => m.to === email));
    expect(await verified(email)).toBe(false);
    sent.length = 0;

    const reset = await post('request-password-reset', { email });
    expect(reset.status).toBe(200);
    await waitFor(() => sent.length === 1);
    expect(sent[0]!.kind).toBe('password_reset');
    const token = /reset-password\/([^?\s]+)/.exec(sent[0]!.text)![1]!;
    const done = await post('reset-password', { newPassword: PASSWORD, token });
    expect(done.status, await done.clone().text()).toBe(200);

    expect(await verified(email)).toBe(true);
    expect((await signIn(email)).status).toBe(200);
  }, 20_000);

  it('драйвер log (dev): signUp дає сесію, як раніше', async () => {
    delete process.env.SMTP_URL;
    delete process.env.MAIL_FROM;
    try {
      auth = createAuth({ secret: SECRET, mailTransport: transport });
      sent.length = 0;
      const response = await signUp('verify-dev@x.test');
      expect(response.status, await response.clone().text()).toBe(200);
      expect(((await response.json()) as { token: unknown }).token).toEqual(
        expect.any(String),
      );
      expect(response.headers.getSetCookie().length).toBeGreaterThan(0);
      expect(sent).toHaveLength(0);
    } finally {
      process.env.SMTP_URL = 'smtp://127.0.0.1:1';
      process.env.MAIL_FROM = 'shop@shop.example';
    }
  });
});
