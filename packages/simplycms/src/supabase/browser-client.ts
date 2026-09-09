import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database';
import { resolveSupabaseKeys } from './keys';

/**
 * Браузерний Supabase-клієнт.
 *
 * `Db` — типи БД магазину: baseline core-схеми пакета (`./database`).
 * 🔴 Generic-містка до host-генерату більше немає — сам генерат знесено
 * в 0.4.1; baseline заморожений до К3, який переписує останнього споживача.
 */
export function createBrowserSupabase<Db extends Database = Database>() {
  const { url, key } = resolveSupabaseKeys(import.meta.env);
  return createBrowserClient<Db>(url, key);
}

/** Тип браузерного клієнта; без параметра — baseline core-схеми. */
export type SupabaseClient<Db extends Database = Database> = ReturnType<
  typeof createBrowserSupabase<Db>
>;

// Lazy browser client (DI source for SupabaseProvider/useSupabaseClient).
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserSupabase();
  }
  return browserClient;
}

// Глобальний singleton `export const supabase` прибрано (P3 core-engine-extraction):
// клієнт інжектиться через SupabaseProvider/useSupabaseClient або createServerSupabase.
