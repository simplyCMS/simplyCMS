import { createServerSupabase } from 'simplycms/supabase/server-client';

/**
 * Чи має поточний користувач роль admin — ЗВИЧАЙНА функція.
 *
 * Саме її викликають server-route handler-и (`server.handlers.*`): у них немає
 * контексту `createServerFn`, тому виклик serverFn-обгортки там впав би.
 * Без сесії → `false`.
 *
 * 🔴 Живе в ОКРЕМОМУ модулі, а не поруч із serverFn-ами в `auth.ts`, і це не
 * косметика. Трансформація TanStack Start вирізає з клієнтського бандла тіла
 * `createServerFn`-хендлерів, після чого їхній `import ... from
 * 'simplycms/supabase/server-client'` стає невживаним і зникає. Звичайна
 * функція такого імунітету не має: як живий експортований символ вона тримає
 * серверний імпорт живим, а в опублікованому пакеті сусідні модулі вже склеєні
 * в один tsup-чанк — тож клієнтський `import { getUser } from '…/server/auth'`
 * (`admin-routes/routes/admin.tsx`) затягнув би сюди весь серверний Supabase.
 * У монорепо цього не видно: там Vite бачить сирці й вирізає невживане.
 * Спіймано Gate C пілота (`node scripts/pilot-pack.mjs`).
 */
export async function checkIsAdmin(): Promise<boolean> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  return !!role;
}
