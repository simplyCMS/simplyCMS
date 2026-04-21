/**
 * @deprecated Замінено на src/server/supabase.ts (createServerSupabase)
 * для TanStack Start. Цей файл залишається для зворотної сумісності
 * з Next.js API routes до повної міграції (Phase 4).
 */
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";

export async function createServerSupabaseClient() {
  // TODO: Замінити на TanStack Start cookie API (vinxi/http getCookie/setCookie)
  const cookieStore = {
    getAll: () => [] as { name: string; value: string }[],
    setAll: () => {},
    set: (_name: string, _value: string, _options?: Record<string, unknown>) => {},
  };

  return createServerClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have proxy refreshing user sessions.
          }
        },
      },
    }
  );
}
