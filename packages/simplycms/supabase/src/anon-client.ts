import { createClient } from '@supabase/supabase-js';
import type { Database } from './database';
import { resolveSupabaseKeys } from './keys';

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
  const { url, key } = resolveSupabaseKeys(import.meta.env);

  return createClient<Database>(url, key);
}
