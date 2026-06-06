import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_ANON_KEY!
  );
}

export type SupabaseClient = ReturnType<typeof createClient>;

// Lazy browser client (DI source for SupabaseProvider/useSupabaseClient).
let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createClient();
  }
  return browserClient;
}

// Глобальний singleton `export const supabase` прибрано (P3 core-engine-extraction):
// клієнт інжектиться через SupabaseProvider/useSupabaseClient або createServerSupabase.
