// Замикання ланцюга «сесія Better Auth → claims → RLS» (Task 7, план В2-К1а).
//
// 🔴 Заради ЦЬОГО файлу будувався весь контур К1а. Кожна попередня задача
// доводила свою половину окремо: Task 5 — що RLS звужує рядки під claims,
// Task 6 — що `withActor` ці claims виставляє, юніти Task 7 — що Better Auth
// живе без Docker. Жодна з них не доводила головного: що id, здобутий із
// РЕАЛЬНОЇ сесії, дійсно замикає ланцюг на реальній БД. Тут signUp іде проти
// накатаного baseline, id береться саме із сесії (не з insert-у), і саме він
// їде у `withActor`.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createAuth,
  issueOwnerInvite,
  ownerInviteStore,
  verifyOwnerInvite,
} from 'simplycms/auth';
import type { InviteEmail } from 'simplycms/auth';
import { closeDbPool, withActor } from 'simplycms/db';
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
const PRODUCT = '44444444-4444-4444-8444-444444444444';
const PASSWORD = 'super-secret-password';

/** Рядки одного SQL від імені актора — той самий прийом, що в with-actor. */
const rowsAs = <T>(
  actor: Parameters<typeof withActor>[0],
  statement: string,
): Promise<T[]> =>
  withActor(
    actor,
    async (db) => (await db.execute(statement)).rows as unknown as T[],
  );

describe('Better Auth над реальним Postgres', () => {
  let harness: { url: string; teardown: () => Promise<void> };
  const dbName = randomDbName('simplycms_auth');
  let dbUrl: string;
  let auth: ReturnType<typeof createAuth>;
  const sentEmails: InviteEmail[] = [];

  /** Реєстрація + id, узятий САМЕ із сесії, а не з відповіді signUp. */
  const signUpAndReadSession = async (email: string): Promise<string> => {
    const response = await auth.api.signUpEmail({
      body: { email, password: PASSWORD, name: 'Оксана Коваль' },
      asResponse: true,
    });
    expect(response.status, await response.clone().text()).toBe(200);

    const cookie = response.headers
      .getSetCookie()
      .map((raw) => raw.split(';')[0])
      .join('; ');
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    expect(session?.user.email).toBe(email);
    return session!.user.id;
  };

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
    await queryRows(
      dbUrl,
      `insert into public.products (id, slug, name)
       values ('${PRODUCT}', 'test-product', 'Тестовий товар')`,
    );

    // Логін — як `app_runtime`: під власником таблиць fail-closed не міряється.
    process.env.DATABASE_URL = withUser(dbUrl, 'app_runtime');
    auth = createAuth({
      secret: 'integration-secret-not-a-real-one',
      baseURL: 'http://localhost:3000',
    });
  }, 120_000);

  afterAll(async () => {
    await closeDbPool();
    delete process.env.DATABASE_URL;
    if (dbUrl) await dropTempDatabase(harness.url, dbName);
    await harness?.teardown();
  });

  it('signUp пише в users і провізує профіль категорією за замовчуванням', async () => {
    const userId = await signUpAndReadSession('first@example.test');

    const [profile] = await queryRows(
      dbUrl,
      `select p.first_name, p.last_name, c.code as category
         from public.profiles p
         left join public.user_categories c on c.id = p.category_id
        where p.user_id = $1`,
      [userId],
    );
    expect(profile).toEqual({
      first_name: 'Оксана',
      last_name: 'Коваль',
      category: 'retail',
    });
  });

  it('інваріант first_user_no_auto_admin тримається на живій БД', async () => {
    // 🔴 Перший зареєстрований у цій БД — попередній тест. Тут асертиться не
    // «роль user є», а «ролі admin у ТАБЛИЦІ немає жодної»: стара діра «хто
    // перший встиг» виглядала б саме як зайвий рядок admin після signUp.
    const roles = await queryRows(
      dbUrl,
      'select role::text from public.user_roles order by role',
    );
    expect(roles).toEqual([{ role: 'user' }]);
  });

  it('id із сесії → withActor → RLS віддає ЛИШЕ рядки цього користувача', async () => {
    const second = await signUpAndReadSession('second@example.test');
    const [first] = await queryRows(
      dbUrl,
      `select id from public.users where email = 'first@example.test'`,
    );

    // Рядки заводить власник таблиць — підготовка не має залежати від того,
    // що саме доводить тест.
    await queryRows(
      dbUrl,
      `insert into public.wishlists (id, user_id, product_id)
       values (gen_random_uuid(), $1, '${PRODUCT}'),
              (gen_random_uuid(), $2, '${PRODUCT}')`,
      [first.id, second],
    );

    const own = await rowsAs<{ user_id: string }>(
      { role: 'app_user', userId: second },
      'select user_id from public.wishlists',
    );
    expect(own.map((row) => row.user_id)).toEqual([second]);

    // Контрольна пара: без claims не видно нічого, з чужим id — лише чуже.
    expect(
      await rowsAs(
        { role: 'app_user' },
        'select user_id from public.wishlists',
      ),
    ).toEqual([]);
    expect(
      (
        await rowsAs<{ user_id: string }>(
          { role: 'app_user', userId: first.id },
          'select user_id from public.wishlists',
        )
      ).map((row) => row.user_id),
    ).toEqual([first.id]);
  });

  it('invite власника: токен випускається, гаситься й дає роль admin', async () => {
    const email = 'owner@example.test';
    const invite = await issueOwnerInvite({
      store: ownerInviteStore,
      sendEmail: async (message) => {
        sentEmails.push(message);
      },
      email,
      siteUrl: 'https://shop.example',
    });

    expect(invite.created).toBe(true);
    expect(sentEmails).toHaveLength(1);

    const token = new URL(invite.url).searchParams.get('token')!;
    expect(
      await verifyOwnerInvite({ store: ownerInviteStore, email, token }),
    ).toEqual({
      ok: true,
      userId: invite.userId,
    });
    // Одноразовість: другий перехід за тим самим посиланням уже мертвий.
    expect(
      await verifyOwnerInvite({ store: ownerInviteStore, email, token }),
    ).toEqual({
      ok: false,
      reason: 'not-found',
    });

    const roles = await queryRows(
      dbUrl,
      `select role::text from public.user_roles where user_id = $1`,
      [invite.userId],
    );
    expect(roles).toEqual([{ role: 'admin' }]);
  });

  it('повторний invite не дублює ні користувача, ні роль', async () => {
    const email = 'owner@example.test';
    const again = await issueOwnerInvite({
      store: ownerInviteStore,
      sendEmail: async (message) => {
        sentEmails.push(message);
      },
      email,
      siteUrl: 'https://shop.example',
    });

    expect(again.created).toBe(false);
    const [counts] = await queryRows(
      dbUrl,
      `select
         (select count(*)::int from public.users where email = $1) as users,
         (select count(*)::int from public.user_roles
           where user_id = $2 and role = 'admin') as roles`,
      [email, again.userId],
    );
    expect(counts).toEqual({ users: 1, roles: 1 });
  });
});
