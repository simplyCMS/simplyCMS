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

/** Перевірити чи поточний користувач має роль admin */
export const isAdmin = createServerFn({ method: 'GET' }).handler(async () => {
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
});
