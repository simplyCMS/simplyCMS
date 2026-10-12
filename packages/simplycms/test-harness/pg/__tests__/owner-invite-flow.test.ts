// Наскрізний флоу першого адміна: запрошення → пароль → вхід → роль admin.
//
// 🔴 Саме цей ланцюг був розірваний: посилання вело на неіснуючу сторінку, а
// пароля запрошений не отримував ніде. Юніти доводять половини (випуск
// токена — без БД, форма сторінки — без сервера), але «власник справді
// увійшов у щойно піднятий магазин» доводиться лише тут: на живій схемі, тим
// самим кодом, що виконує роут `/auth/invite`.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acceptOwnerInvite,
  createAuth,
  getAuth,
  isAdminRequest,
  issueOwnerInvite,
  ownerInviteStore,
  readSessionSubject,
  resetAuth,
} from 'simplycms/auth';
import type { MailMessage } from 'simplycms/mail';
import { closeDbPool } from 'simplycms/db';
import { resolveHarness } from '../up.mjs';
import {
  applyCanon,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';

const OWNER = 'owner@example.test';
const SHOPPER = 'shopper@example.test';
const PASSWORD = 'owner-password-not-a-real-one';
const SITE = 'https://shop.example';

describe('запрошення власника наскрізь', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_invite');
  let dbUrl: string;
  const letters: MailMessage[] = [];
  let inviteUrl: string;
  let userId: string;

  /** Cookie-рядок із відповіді BA — те, що браузер відправив би назад. */
  const cookieOf = (response: Response): string =>
    response.headers
      .getSetCookie()
      .map((raw) => raw.split(';')[0])
      .join('; ');

  const signIn = (email: string, password: string): Promise<Response> =>
    getAuth().api.signInEmail({ body: { email, password }, asResponse: true });

  beforeAll(async () => {
    harness = await resolveHarness();
    await createTempDatabase(harness.url, dbName);
    dbUrl = withDbName(harness.url, dbName);
    await applyCanon(dbUrl);

    // Як у проді: застосунок конектиться `app_runtime`, а інстанс auth
    // береться синглтоном `getAuth()` — тим самим, що обслуговує `/api/auth/$`.
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
    process.env.BETTER_AUTH_SECRET = 'invite-flow-secret-not-a-real-one';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    resetAuth();
  }, 120_000);

  afterAll(async () => {
    resetAuth();
    await closeDbPool();
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;
    delete process.env.BETTER_AUTH_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('посилання з листа веде на /auth/invite і несе пошту з токеном', async () => {
    const invite = await issueOwnerInvite({
      store: ownerInviteStore,
      schedule: async (items) => {
        letters.push(...items.map((item) => item.message));
        return [];
      },
      email: OWNER,
      env: { VITE_SITE_URL: SITE },
    });
    inviteUrl = invite.url;
    userId = invite.userId;

    const url = new URL(inviteUrl);
    // 🔴 Головний асерт цього кроку: саме `/auth/invite`. Доти посилання
    // вказувало на сторінку, якої в роутері не існувало, — і флоу мовчки
    // закінчувався 404-ю.
    expect(url.pathname).toBe('/auth/invite');
    expect(url.searchParams.get('email')).toBe(OWNER);
    expect(url.searchParams.get('token')).toBeTruthy();
    expect(letters[0].text).toContain(inviteUrl);
  });

  it('токен + пароль → вхід працює, сесія бачить роль admin', async () => {
    const token = new URL(inviteUrl).searchParams.get('token')!;

    const accepted = await acceptOwnerInvite({
      auth: getAuth(),
      store: ownerInviteStore,
      email: OWNER,
      token,
      password: PASSWORD,
    });
    expect(accepted).toEqual({ ok: true, userId });

    const response = await signIn(OWNER, PASSWORD);
    expect(response.status, await response.clone().text()).toBe(200);

    const headers = new Headers({ cookie: cookieOf(response) });
    const session = await getAuth().api.getSession({ headers });
    expect(session?.user.id).toBe(userId);
    // Перехід за одноразовим посиланням і є підтвердженням пошти.
    expect(session?.user.emailVerified).toBe(true);
    // Ланцюг замкнено: та сама функція, якою гард адмінки пускає в `/admin`.
    expect(await isAdminRequest(headers)).toBe(true);
  });

  it('повторне використання того самого токена відбите', async () => {
    const token = new URL(inviteUrl).searchParams.get('token')!;

    const replay = await acceptOwnerInvite({
      auth: getAuth(),
      store: ownerInviteStore,
      email: OWNER,
      token,
      password: 'password-from-the-attacker',
    });
    expect(replay).toEqual({ ok: false, reason: 'not-found' });

    // 🔴 Мало відбити спробу — пароль не мусив змінитися: інакше «відбито»
    // означало б лише «нам не сказали, що вдалося».
    expect((await signIn(OWNER, PASSWORD)).status).toBe(200);
    expect((await signIn(OWNER, 'password-from-the-attacker')).status).not.toBe(
      200,
    );
  });

  it('роль admin дає лише запрошення, а не факт реєстрації', async () => {
    const signUp = await getAuth().api.signUpEmail({
      body: { email: SHOPPER, password: PASSWORD, name: 'Оксана Коваль' },
      asResponse: true,
    });
    expect(signUp.status).toBe(200);

    // Інваріант `first_user_no_auto_admin`: адмін у магазині рівно один — той,
    // кого запросили.
    const roles = await queryRows(
      dbUrl,
      `select u.email, r.role::text as role
         from public.user_roles r
         join public.users u on u.id = r.user_id
        order by u.email`,
    );
    expect(roles).toEqual([
      { email: OWNER, role: 'admin' },
      { email: SHOPPER, role: 'user' },
    ]);
  });
  describe('Р19: роль лише після прийняття, сесії гаснуть', () => {
    const NEW_PASSWORD = 'owner-new-password-after-accept';
    const schedule = async (items: readonly { message: MailMessage }[]) => {
      letters.push(...items.map((item) => item.message));
      return [];
    };
    const roleRows = (id: string) =>
      queryRows(
        dbUrl,
        `select role::text as role from public.user_roles where user_id = $1`,
        [id],
      );
    const adminRoleCount = async (id: string) =>
      (await roleRows(id)).filter((r) => r.role === 'admin').length;
    const tokenOf = (url: string) => new URL(url).searchParams.get('token')!;
    const headersOf = (response: Response) =>
      new Headers({ cookie: cookieOf(response) });

    const HIJACK = 'hijack@example.test';
    let hijackSession: Headers;
    let hijackInvite: { userId: string; url: string };

    it('(1) пошту зайнято самореєстрацією: випуск запрошення НЕ дає ролі живій сесії', async () => {
      const signUp = await getAuth().api.signUpEmail({
        body: { email: HIJACK, password: PASSWORD, name: 'Зловмисник' },
        asResponse: true,
      });
      expect(signUp.status).toBe(200);
      hijackSession = headersOf(signUp);

      const invite = await issueOwnerInvite({
        store: ownerInviteStore,
        schedule,
        email: HIJACK,
        env: { VITE_SITE_URL: SITE },
      });
      hijackInvite = invite;
      expect(invite.created).toBe(false);
      expect(invite.existingUnverified).toBe(true);

      const subject = await readSessionSubject(hijackSession);
      expect(subject?.userId).toBe(invite.userId);
      expect(subject?.roles).not.toContain('admin');
      expect(await adminRoleCount(invite.userId)).toBe(0);
    });

    it('(2) прийняття гасить сесію самореєстрації, новий вхід дає admin', async () => {
      const accepted = await acceptOwnerInvite({
        auth: getAuth(),
        store: ownerInviteStore,
        email: HIJACK,
        token: tokenOf(hijackInvite.url),
        password: NEW_PASSWORD,
      });
      expect(accepted).toEqual({ ok: true, userId: hijackInvite.userId });

      expect(
        await getAuth().api.getSession({ headers: hijackSession }),
      ).toBeNull();
      // Старий пароль зловмисника теж не діє.
      expect((await signIn(HIJACK, PASSWORD)).status).not.toBe(200);

      const fresh = await signIn(HIJACK, NEW_PASSWORD);
      expect(fresh.status).toBe(200);
      const subject = await readSessionSubject(headersOf(fresh));
      expect(subject?.roles).toContain('admin');
    });

    it('(3) звичайне скидання пароля гасить живі сесії', async () => {
      const email = 'reset-revokes@example.test';
      await getAuth().api.signUpEmail({
        body: { email, password: PASSWORD, name: 'Покупець' },
      });
      const session = headersOf(await signIn(email, PASSWORD));
      expect(
        await getAuth().api.getSession({ headers: session }),
      ).not.toBeNull();

      const resetMails: MailMessage[] = [];
      const auth = createAuth({
        schedule: async (items) => {
          resetMails.push(...items.map((item) => item.message));
          return [];
        },
        mailTransport: { driver: 'smtp', send: async () => {} },
      });
      await auth.api.requestPasswordReset({ body: { email } });
      expect(resetMails).toHaveLength(1);
      const token = /reset-password\/([^?\s"]+)/.exec(resetMails[0]!.text)![1];

      await auth.api.resetPassword({
        body: { newPassword: 'another-password-after-reset', token },
      });
      expect(await getAuth().api.getSession({ headers: session })).toBeNull();
    });

    it('(6) BA відхиляє пароль: ролі admin немає, токен спожито', async () => {
      const email = 'weak-password@example.test';
      const invite = await issueOwnerInvite({
        store: ownerInviteStore,
        schedule,
        email,
        env: { VITE_SITE_URL: SITE },
      });
      const token = tokenOf(invite.url);
      const args = {
        auth: getAuth(),
        store: ownerInviteStore,
        email,
        token,
      };
      expect(await acceptOwnerInvite({ ...args, password: 'short' })).toEqual({
        ok: false,
        reason: 'password-rejected',
      });
      expect(await adminRoleCount(invite.userId)).toBe(0);
      expect(
        await acceptOwnerInvite({ ...args, password: NEW_PASSWORD }),
      ).toEqual({ ok: false, reason: 'not-found' });
    });

    it('(7) бан між випуском і прийняттям: not-found, ролі admin немає', async () => {
      const email = 'banned-between@example.test';
      const invite = await issueOwnerInvite({
        store: ownerInviteStore,
        schedule,
        email,
        env: { VITE_SITE_URL: SITE },
      });
      await queryRows(
        dbUrl,
        `update public.users set banned_at = now() where id = $1`,
        [invite.userId],
      );
      expect(
        await acceptOwnerInvite({
          auth: getAuth(),
          store: ownerInviteStore,
          email,
          token: tokenOf(invite.url),
          password: NEW_PASSWORD,
        }),
      ).toEqual({ ok: false, reason: 'not-found' });
      expect(await adminRoleCount(invite.userId)).toBe(0);
    });
  });
});
