import { and, eq } from 'drizzle-orm';
import { withActor } from 'simplycms/db';
import { userRoles } from 'simplycms/schema';
import { createServerSupabase } from 'simplycms/supabase/server-client';

/**
 * Чи має поточний користувач роль admin — ЗВИЧАЙНА функція.
 *
 * Саме її викликають server-route handler-и (`server.handlers.*`): у них немає
 * контексту `createServerFn`, тому виклик serverFn-обгортки там впав би.
 * Без сесії → `false`.
 *
 * 🔴 Контур ГІБРИДНИЙ і буде таким до К1′б: ідентичність усе ще приходить з
 * GoTrue (`supabase.auth.getUser()`), а сама роль читається вже з Postgres
 * через `withActor`. Перемикання на Better Auth — окремий контур; сюди він
 * прийде заміною ОДНОГО рядка з `getUser`.
 *
 * 🔴 Актор — `app_user` із `userId`, а не `app_admin`. Політика
 * `user_roles_select_own` віддає під нею рівно рядки цього користувача, тож
 * перевірка не потребує підвищених прав: питати «чи я адмін» правами адміна
 * означало б перевіряти невідоме відомим.
 *
 * 🔴 Живе в ОКРЕМОМУ модулі, а не поруч із serverFn-ами в `auth.ts`.
 * Трансформація TanStack Start вирізає з клієнтського бандла тіла
 * `createServerFn`-хендлерів, після чого їхні серверні імпорти стають
 * невживаними і зникають. Звичайна функція такого імунітету не має: як живий
 * експортований символ вона тримає серверний імпорт живим, а в опублікованому
 * пакеті сусідні модулі вже склеєні в один tsup-чанк — тож клієнтський
 * `import { getUser } from '…/server/auth'` (`admin-routes/routes/admin.tsx`)
 * затягнув би сюди і Supabase, і пул Postgres. У монорепо цього не видно:
 * там Vite бачить сирці й вирізає невживане. Спіймано Gate C пілота.
 */
export async function checkIsAdmin(): Promise<boolean> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  return withActor({ role: 'app_user', userId: user.id }, async (db) => {
    const [role] = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(and(eq(userRoles.userId, user.id), eq(userRoles.role, 'admin')))
      .limit(1);

    return Boolean(role);
  });
}
