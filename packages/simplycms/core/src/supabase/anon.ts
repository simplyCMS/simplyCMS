import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Анонімний Supabase-клієнт для публічних запитів без cookies.
 *
 * Використовується для кешованих server-side запитів (unstable_cache),
 * де cookie-based клієнт неприпустимий (кеш — cross-request).
 * Підходить для таблиць з RLS policy "viewable by everyone".
 *
 * НЕ використовуй для запитів що потребують авторизації.
 */
export function createAnonSupabaseClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      '[createAnonSupabaseClient] Відсутні змінні оточення: ' +
      'VITE_SUPABASE_URL та VITE_SUPABASE_ANON_KEY обовʼязкові.'
    );
  }

  return createClient<Database>(url, key);
}
