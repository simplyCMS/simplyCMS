import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Клієнт даних для storefront-лоадерів. Параметр-схема НЕ фіксується тут
 * (default-generic `any`), щоб пакет не залежав від конкретної `Database`
 * (host/marketplace інжектує свій типізований клієнт — він структурно сумісний).
 */
export type StorefrontClient = SupabaseClient;
