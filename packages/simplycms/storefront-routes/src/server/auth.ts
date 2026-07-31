import { createServerFn } from '@tanstack/react-start';
import { createServerSupabase } from '@simplycms/supabase/server-client';

/** Отримати поточну сесію користувача */
export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const supabase = createServerSupabase();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error('[getSession] Помилка:', error.message);
      return null;
    }

    return session;
  },
);

/** Отримати поточного користувача (з перевіркою JWT) */
export const getUser = createServerFn({ method: 'GET' }).handler(async () => {
  const supabase = createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[getUser] Помилка:', error.message);
    return null;
  }

  return user;
});

/**
 * Чи має поточний користувач роль admin — ЗВИЧАЙНА функція.
 *
 * Саме її викликають server-route handler-и (`server.handlers.*`): у них немає
 * контексту `createServerFn`, тому виклик serverFn-обгортки там впав би.
 * Без сесії → `false`.
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

/** Перевірити чи поточний користувач має роль admin (serverFn для роутів/компонентів) */
export const isAdmin = createServerFn({ method: 'GET' }).handler(async () =>
  checkIsAdmin(),
);
