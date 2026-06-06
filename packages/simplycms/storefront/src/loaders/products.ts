import type { StorefrontClient } from "../client";

/** Повний select для сторінки товару (з усіма зв'язками) */
export const PRODUCT_FULL_SELECT = `
  *,
  sections(id, slug, name),
  product_modifications(*),
  product_prices(price_type_id, price, old_price, modification_id),
  product_property_values(
    property_id,
    value,
    numeric_value,
    option_id,
    property_options:option_id(id, slug),
    section_properties:property_id(id, name, slug, property_type, has_page)
  )
` as const;

/** Отримати товар за slug (для сторінки товару) */
export async function loadProduct(client: StorefrontClient, slug: string) {
  const { data, error } = await client
    .from("products")
    .select(PRODUCT_FULL_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[loadProduct] Помилка:", error.message);
  }

  return data;
}

/** Отримати всі активні товари (каталог) */
export async function loadProducts(client: StorefrontClient) {
  const { data, error } = await client
    .from("products")
    .select("*, sections(*), product_modifications(*)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[loadProducts] Помилка:", error.message);
  }

  return data ?? [];
}

/** Отримати товари за ID секції */
export async function loadProductsBySectionId(
  client: StorefrontClient,
  sectionId: string,
) {
  const { data, error } = await client
    .from("products")
    .select("*, product_modifications(*)")
    .eq("section_id", sectionId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[loadProductsBySectionId] Помилка:", error.message);
  }

  return data ?? [];
}
