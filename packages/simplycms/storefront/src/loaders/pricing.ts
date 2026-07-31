import type { StorefrontClient } from "../client";

/**
 * ID типу ціни «за замовчуванням». Потрібен серверному резолву цін у списках
 * каталогу: SSR рендериться анонімно, тож ціни рахуються саме за цим типом.
 */
export async function loadDefaultPriceTypeId(
  client: StorefrontClient,
): Promise<string | null> {
  const { data, error } = await client
    .from("price_types")
    .select("id")
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    console.error("[loadDefaultPriceTypeId] Помилка:", error.message);
    return null;
  }

  return data?.id ?? null;
}
