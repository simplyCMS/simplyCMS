import { createFileRoute } from '@tanstack/react-router';
import { createServerSupabase } from 'simplycms/supabase/server-client';

/**
 * Diagnostic endpoint — перевірка конфігурації та підключення до Supabase.
 * Використання: GET /api/health
 */
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        const checks: Record<string, Record<string, unknown>> = {};

        // Серверний контур читає env з `process.env` у рантаймі (контракт
        // серверного env, спека CLI v1 §7) — перевіряємо те саме джерело,
        // з якого `createServerSupabase` нижче візьме ключі.
        checks.envVars = {
          VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
          VITE_SUPABASE_ANON_KEY: !!process.env.VITE_SUPABASE_ANON_KEY,
        };

        try {
          const supabase = createServerSupabase();
          const { data, error } = await supabase
            .from('banners')
            .select('count')
            .limit(1);

          checks.supabaseConnection = {
            success: !error,
            error: error?.message || null,
            dataReceived: !!data,
          };
        } catch (supabaseError) {
          checks.supabaseConnection = {
            success: false,
            error:
              supabaseError instanceof Error
                ? supabaseError.message
                : 'Unknown error',
          };
        }

        const allChecksPass = Object.values(checks).every(
          (check) => check.success !== false,
        );

        return Response.json(
          {
            status: allChecksPass ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            checks,
          },
          { status: allChecksPass ? 200 : 503 },
        );
      },
    },
  },
});
