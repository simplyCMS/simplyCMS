import { createServerClient } from '@supabase/ssr';
import { parseCookieHeader } from '@supabase/ssr';
import {
  getRequestHeader,
  setCookie,
} from '@tanstack/react-start/server';
import type { Database } from '@simplycms/core/supabase/types';

/**
 * Factory для створення серверного Supabase-клієнта в TanStack Start.
 *
 * Читає cookies через getRequestHeader('cookie'),
 * записує через setCookie() — обовʼязково для session refresh
 * і token rotation @supabase/ssr.
 *
 * Викликати лише всередині createServerFn handler або middleware.
 */
export function createServerSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      '[createServerSupabase] Відсутні змінні оточення: ' +
      'VITE_SUPABASE_URL та VITE_SUPABASE_ANON_KEY обовʼязкові.',
    );
  }

  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          const header = getRequestHeader('cookie') ?? '';
          return parseCookieHeader(header).map(({ name, value }) => ({
            name,
            value: value ?? '',
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            setCookie(name, value, options);
          });
        },
      },
    },
  );
}
