import { createFileRoute } from '@tanstack/react-router';
import { createServerSupabase } from '@simplycms/supabase/server-client';
import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Підтвердження email-лінків (invite/magiclink/recovery) за SSR-моделлю
 * Supabase: `verifyOtp(token_hash)` на сервері ставить auth-cookies і
 * редиректить на `next`. Редірект одразу прибирає токен з URL — у History
 * та Referer сторінок застосунку він не потрапляє.
 *
 * Стандартний `?code=`-callback для invite не працює: лист приносить
 * `token_hash`, а не code, тож потрібен окремий серверний роут.
 */
export const Route = createFileRoute('/auth/confirm')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { searchParams, origin } = new URL(request.url);
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type') as EmailOtpType | null;

        // Той самий захист від open redirect, що в callback.tsx: лише
        // same-origin відносний шлях з одного '/' (не '//' і не '/\').
        const rawNext = searchParams.get('next') ?? '/';
        const next =
          rawNext.startsWith('/') &&
          !rawNext.startsWith('//') &&
          !rawNext.startsWith('/\\')
            ? rawNext
            : '/';

        if (tokenHash && type) {
          const supabase = createServerSupabase();
          const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash: tokenHash,
          });
          if (!error) {
            return Response.redirect(`${origin}${next}`, 302);
          }
        }

        return Response.redirect(`${origin}/auth?error=auth_error`, 302);
      },
    },
  },
});
