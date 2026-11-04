// Провізія при вході (самовідновлення): користувач, чия провізія впала при створенні, не лишається
// без профілю назавжди. Реальний `createAuth` на живій БД, без підмін.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuth } from 'simplycms/auth';
import { closeDbPool } from 'simplycms/db';
import * as F from './fixtures/customer-categories';

const PASSWORD = 'super-secret-password';

describe('Better Auth: провізія при вході', () => {
  const db = F.useCustomersDb('simplycms_auth_self_heal');
  let auth: ReturnType<typeof createAuth>;
  beforeAll(() => {
    auth = createAuth({
      secret: 'integration-secret-not-a-real-one',
      baseURL: 'http://localhost:3000',
    });
  });
  afterAll(() => closeDbPool());

  const q = (sql: string, params: unknown[] = []) =>
    F.rows(db.url(), sql, params);
  const signUp = async (email: string) => {
    await auth.api.signUpEmail({
      body: { email, password: PASSWORD, name: 'Самовідновлення Тест' },
    });
    const [u] = await q(`select id from public.users where email = $1`, [
      email,
    ]);
    return String(u!.id);
  };
  const signIn = (email: string) =>
    auth.api.signInEmail({ body: { email, password: PASSWORD } });

  it('користувач без профілю і ролі входить → профіль і роль user створено', async () => {
    const id = await signUp('no-profile@example.test');
    // Імітація збою провізії при створенні.
    await q(`delete from public.profiles where user_id = $1`, [id]);
    await q(`delete from public.user_roles where user_id = $1`, [id]);

    await signIn('no-profile@example.test');

    const profile = await q(
      `select email, first_name, category_id from public.profiles where user_id = $1`,
      [id],
    );
    expect(profile).toHaveLength(1);
    expect(profile[0]).toMatchObject({
      email: 'no-profile@example.test',
      first_name: 'Самовідновлення',
    });
    expect(profile[0]!.category_id).not.toBeNull();
    const roles = await q(
      `select role from public.user_roles where user_id = $1`,
      [id],
    );
    expect(roles.map((r) => r.role)).toEqual(['user']);
  });

  // Негативний контроль: наявні рядки не змінюються, адмін не отримує другої ролі.
  it('користувач із профілем і роллю admin входить → рядки без змін, ролі user немає', async () => {
    const id = await signUp('admin-keeps@example.test');
    await q(`delete from public.user_roles where user_id = $1`, [id]);
    await q(
      `insert into public.user_roles (id, user_id, role) values (gen_random_uuid(), $1, 'admin')`,
      [id],
    );
    await q(
      `update public.profiles set first_name = 'Власне', ui_locale = 'en' where user_id = $1`,
      [id],
    );
    const before = await q(`select * from public.profiles where user_id = $1`, [
      id,
    ]);

    await signIn('admin-keeps@example.test');

    expect(
      await q(`select * from public.profiles where user_id = $1`, [id]),
    ).toEqual(before);
    const roles = await q(
      `select role from public.user_roles where user_id = $1`,
      [id],
    );
    expect(roles.map((r) => r.role)).toEqual(['admin']);
  });
});
