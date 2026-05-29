import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@simplycms/core/supabase/types";

/**
 * Клієнт даних для storefront-лоадерів. Будь-яка реалізація Supabase-клієнта
 * (browser / server / anon) типу SupabaseClient<Database> підходить —
 * host інжектує свій клієнт, пакет не залежить від framework-glue.
 */
export type StorefrontClient = SupabaseClient<Database>;
