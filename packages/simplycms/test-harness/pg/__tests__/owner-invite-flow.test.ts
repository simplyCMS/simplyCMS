// Наскрізний флоу першого адміна: запрошення → пароль → вхід → роль admin.
//
// 🔴 Саме цей ланцюг був розірваний: посилання вело на неіснуючу сторінку, а
// пароля запрошений не отримував ніде. Юніти доводять половини (випуск
// токена — без БД, форма сторінки — без сервера), але «власник справді
// увійшов у щойно піднятий магазин» доводиться лише тут: на живій схемі, тим
// самим кодом, що виконує роут `/auth/invite`.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  acceptOwnerInvite,
  getAuth,
  isAdminRequest,
  issueOwnerInvite,
  ownerInviteStore,
  resetAuth,
} from 'simplycms/auth';
import type { InviteEmail } from 'simplycms/auth';
import { closeDbPool } from 'simplycms/db';
import { resolveHarness } from '../up.mjs';
import {
  applySqlFiles,
  createTempDatabase,
  dropTempDatabase,
  queryRows,
  randomDbName,
  withDbName,
  withUser,
} from '../apply.mjs';

const CANON_DIR = join(import.meta.dirname, '../../../migrations');
const OWNER = 'owner@example.test';
const SHOPPER = 'shopper@example.test';
const PASSWORD = 'owner-password-not-a-real-one';
const SITE = 'https://shop.example';

describe('запрошення власника наскрізь', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_invite');
  let dbUrl: string;
  const letters: InviteEmail[] = [];
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
    await applySqlFiles(
      dbUrl,
      readdirSync(CANON_DIR)
        .filter((name) => name.endsWith('.sql'))
        .sort()
        .map((name) => join(CANON_DIR, name)),
    );

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
      sendEmail: async (message) => {
        letters.push(message);
      },
      email: OWNER,
      siteUrl: SITE,
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
});
