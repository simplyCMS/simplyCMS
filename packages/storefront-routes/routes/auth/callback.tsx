import { createFileRoute } from '@tanstack/react-router';
import { createServerSupabase } from 'simplycms/supabase/server-client';
import { redirectResponse } from '@simplycms/storefront-routes/server/redirect';

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
            // 🔴 redirectResponse, а не Response.redirect: той дає immutable
            // headers і Start падає, доклеюючи auth-cookies (див. хелпер).
            return redirectResponse(`${origin}${next}`);
          }
        }

        return redirectResponse(`${origin}/auth?error=auth_error`);
      },
    },
  },
});
