import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database';
import { resolveSupabaseKeys } from './keys';

export function createClient() {
  const { url, key } = resolveSupabaseKeys(import.meta.env);
  return createBrowserClient<Database>(url, key);
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
