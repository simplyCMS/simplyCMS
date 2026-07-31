import type { SupabaseClient } from "@simplycms/supabase/browser-client";

// Pure-розрахунок наявності перенесено в @simplycms/domain/inventory.
// Re-export для зворотної сумісності.
export {
  calculateProductAvailability,
  enrichProductsWithAvailability,
} from "@simplycms/domain/inventory";
export type { StockData } from "@simplycms/domain/inventory";

/** Елемент характеристики модифікації */
export interface ModPropertyValue {
  modification_id: string;
  property_id: string;
  value: string | null;
  numeric_value: number | null;
  option_id: string | null;
}

/**
 * Fetches modification property values
 */
export async function fetchModificationPropertyValues(
  supabase: SupabaseClient,
  modificationIds: string[]
): Promise<Record<string, ModPropertyValue[]>> {
  if (modificationIds.length === 0) return {};

  const { data } = await supabase
    .from("modification_property_values")
    .select("modification_id, property_id, value, numeric_value, option_id")
    .in("modification_id", modificationIds);

  const result: Record<string, ModPropertyValue[]> = {};
  data?.forEach((v) => {
    if (!result[v.modification_id]) {
      result[v.modification_id] = [];
    }
    result[v.modification_id].push(v);
  });

  return result;
}

/**
 * Fetches stock data for modifications
 */
export async function fetchModificationStockData(
  supabase: SupabaseClient,
  modificationIds: string[]
): Promise<Record<string, number>> {
  if (modificationIds.length === 0) return {};

  const { data } = await supabase
    .from("stock_by_pickup_point")
    .select("modification_id, quantity")
    .in("modification_id", modificationIds);

  const stock: Record<string, number> = {};
  data?.forEach((s) => {
    if (s.modification_id) {
      stock[s.modification_id] = (stock[s.modification_id] || 0) + s.quantity;
    }
  });

  return stock;
}
