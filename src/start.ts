import { createStart, createMiddleware } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';
import { createServerSupabase } from '@simplycms/supabase/server-client';

/**
 * Server-side guard для початкового запиту на `/admin`.
 *
 * Admin shell повністю client-only (`ssr: false`), тому його `beforeLoad`
 * виконується лише на клієнті після гідрації. Цей request middleware закриває
 * прогалину: він редиректить незалогінених / не-admin користувачів ще до рендеру
 * shell на першому HTTP-запиті.
 *
 * `/profile` тут НЕ перевіряється — `_protected` SSR-роут уже захищений серверним
 * `beforeLoad` (не дублюємо guard).
 */
const adminRequestGuard = createMiddleware().server(
  async ({ next, request }) => {
    const { pathname } = new URL(request.url);

    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      // Без env Supabase guard неможливий — пропускаємо (admin однаково не запрацює).
      if (
        import.meta.env.VITE_SUPABASE_URL &&
        import.meta.env.VITE_SUPABASE_ANON_KEY
      ) {
        // Передаємо cookie з request напряму — не залежимо від ALS getRequestHeader.
        const supabase = createServerSupabase(
          request.headers.get('cookie') ?? '',
        );
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw redirect({ to: '/auth' });
        }

        const { data: role } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (!role) {
          throw redirect({ to: '/' });
        }
      }
    }

    return next();
  },
);

export const startInstance = createStart(() => ({
  requestMiddleware: [adminRequestGuard],
}));
