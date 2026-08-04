/**
 * Три перевірки Gate E, винесені з `gate-e.mjs` (ліміт 150 рядків на файл).
 *
 * Кожна повертає `{ passed, fact }` — сам вердикт складає гейт, а сюди
 * потрапляє лише ФАКТ (статус, кількість рядків, текст помилки), щоб у звіті
 * було видно, ЧОМУ впало, без повторного прогону.
 */

import { execFileSync } from 'node:child_process';

/** Фікстури гейта: адреси навмисно в `.local`, щоб не збігтися з реальними. */
export const SHOPPER_EMAIL = 'shopper-gate-e@pilot.local';
export const OWNER_EMAIL = 'owner-gate-e@pilot.local';
const SHOPPER_PASSWORD = 'shopper-password-1';

/**
 * Крок 1: свіжий покупець після `db reset` не має отримати admin — це і є
 * доказ, що міграція `first_user_no_auto_admin` лежить у ЖИВІЙ схемі.
 */
export async function checkFirstSignupIsNotAdmin(anon, admin) {
  const signup = await anon.auth.signUp({
    email: SHOPPER_EMAIL,
    password: SHOPPER_PASSWORD,
  });
  if (signup.error || !signup.data.user) {
    return {
      passed: false,
      fact: `signUp: ${signup.error?.message ?? 'без user'}`,
    };
  }
  const roles = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', signup.data.user.id);
  if (roles.error) {
    return { passed: false, fact: `user_roles: ${roles.error.message}` };
  }
  const isAdmin = roles.data.some((row) => row.role === 'admin');
  return {
    passed: !isAdmin,
    fact: isAdmin
      ? 'перший signup отримав admin — діра жива'
      : `ролей у покупця: ${roles.data.length}`,
  };
}

/**
 * Крок 2: два прогони `scripts/owner-invite.mjs` із каталогу скретч-магазину
 * (скрипт приходить туди з шаблону `create-simplycms-store`). Ідемпотентність
 * означає рівно одного користувача і рівно один рядок ролі admin.
 */
export async function checkOwnerInvite(admin, storeDir, inviteEnv) {
  try {
    for (let run = 0; run < 2; run += 1) {
      execFileSync('node', ['scripts/owner-invite.mjs'], {
        cwd: storeDir,
        env: inviteEnv,
        stdio: 'pipe',
      });
    }
  } catch (error) {
    const stderr = String(error.stderr ?? '').trim();
    return {
      passed: false,
      fact: `owner-invite впав: ${stderr || error.message}`,
    };
  }

  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) {
    return { passed: false, fact: `listUsers: ${list.error.message}` };
  }
  const owners = list.data.users.filter((user) => user.email === OWNER_EMAIL);
  if (owners.length !== 1) {
    return { passed: false, fact: `власників у auth.users: ${owners.length}` };
  }
  const roles = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', owners[0].id);
  if (roles.error) {
    return { passed: false, fact: `user_roles: ${roles.error.message}` };
  }
  const adminRoles = roles.data.filter((row) => row.role === 'admin');
  return {
    passed: adminRoles.length === 1,
    fact: `2 прогони → 1 користувач, рядків admin: ${adminRoles.length}`,
  };
}

/**
 * Крок 3: `token_hash` → auth-cookies → 302 на `/auth/set-password`.
 *
 * `generateLink` не шле листа — він віддає той самий хеш, який GoTrue вклав би
 * у `invite.html`, тож перевіряється справжній шлях користувача, а не макет.
 */
export async function checkConfirmRedirect(admin, storeUrl) {
  const link = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: OWNER_EMAIL,
  });
  if (link.error) {
    return { passed: false, fact: `generateLink: ${link.error.message}` };
  }

  const url =
    `${storeUrl}/auth/confirm?token_hash=${link.data.properties.hashed_token}` +
    '&type=magiclink&next=/auth/set-password';
  const response = await fetch(url, { redirect: 'manual' });
  const location = response.headers.get('location') ?? '';
  const cookies = (response.headers.getSetCookie?.() ?? []).join(';');
  const redirected =
    response.status === 302 && location.endsWith('/auth/set-password');
  const hasSession = cookies.includes('sb-');
  return {
    passed: redirected && hasSession,
    fact: `${response.status} → ${location || '(без Location)'}, auth-cookies: ${hasSession}`,
  };
}
