import { createServerFn } from '@tanstack/react-start';
import { createServerSupabase } from 'simplycms/supabase/server-client';
import { checkIsAdmin } from './is-admin';

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
 * Перевірити чи поточний користувач має роль admin (serverFn для роутів/компонентів).
 *
 * 🔴 Сама перевірка живе в `./is-admin` і навмисно НЕ реекспортується звідси:
 * цей модуль клієнтські роути імпортують заради `getUser`, і будь-який живий
 * не-serverFn експорт тут затягнув би серверний Supabase у клієнтський бандл
 * (див. коментар у `is-admin.ts`).
 */
export const isAdmin = createServerFn({ method: 'GET' }).handler(async () =>
  checkIsAdmin(),
);
