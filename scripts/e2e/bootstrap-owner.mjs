/**
 * Власник-адмін для e2e-прогону проти локального стеку.
 *
 * 🔴 Перевикористовує `runOwnerInvite` (той самий код, що доводить Gate E,
 * `scripts/pilot-pack/gate-e.mjs`) замість другого механізму bootstrap-у:
 * ідемпотентний invite + upsert ролі `admin` лишається ЄДИНИМ джерелом
 * правди. Єдине, чого invite-флоу не дає, — пароль (лист веде на
 * `/auth/confirm`, а не ставить credentials): для логіну формою (як робить
 * реальний користувач у специфікаціях) пароль і підтверджений email
 * додаються окремим кроком через `updateUserById` — той самий прийом, що
 * описаний у `docs/architecture/test-contours.md` §6.2 для ручного підняття
 * контуру («auth.admin.createUser + пароль замість листа»).
 */

import { createClient } from '@supabase/supabase-js';
import { runOwnerInvite } from '../../packages/create-simplycms-store/template/scripts/owner-invite-core.mjs';

export const OWNER_EMAIL = 'owner-e2e@pilot.local';
export const OWNER_PASSWORD = 'e2e-owner-password-1';

/**
 * @param {{ supabaseUrl: string; serviceRoleKey: string; siteUrl: string }} opts
 */
export async function bootstrapOwner({ supabaseUrl, serviceRoleKey, siteUrl }) {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { userId } = await runOwnerInvite({
    admin,
    email: OWNER_EMAIL,
    siteUrl,
    // Тихо: сам лист нас не цікавить (Mailpit тут не читаємо) — потрібні
    // лише userId і закріплена роль admin.
    log: () => {},
  });

  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: OWNER_PASSWORD,
    email_confirm: true,
  });
  if (error) {
    throw new Error(`bootstrapOwner: updateUserById — ${error.message}`);
  }

  return { email: OWNER_EMAIL, password: OWNER_PASSWORD };
}
