import { createFileRoute } from '@tanstack/react-router';
import { createServerSupabase } from '@simplycms/supabase/server-client';

/**
 * OAuth callback як server route handler.
 *
 * Отримує `code` з query-параметрів, обмінює його на сесію через серверний
 * Supabase-клієнт (встановлює auth-cookies) і редиректить на `next` або `/`.
 */
export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { searchParams, origin } = new URL(request.url);
        const code = searchParams.get('code');

        // Захист від open redirect: дозволяємо лише same-origin відносний шлях,
        // що починається з одного '/' (не '//' і не '/\').
        const rawNext = searchParams.get('next') ?? '/';
        const next =
          rawNext.startsWith('/') &&
          !rawNext.startsWith('//') &&
          !rawNext.startsWith('/\\')
            ? rawNext
            : '/';

        if (code) {
          const supabase = createServerSupabase();
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            return Response.redirect(`${origin}${next}`, 302);
          }
        }

        return Response.redirect(`${origin}/auth?error=auth_error`, 302);
      },
    },
  },
});
