import { supabase } from "@/integrations/supabase/client";

interface ProductModification {
  id: string;
  stock_status: string | null;
  is_default: boolean;
  sort_order: number;
}

interface RawProduct {
  id: string;
  stock_status: string | null;
  has_modifications: boolean | null;
  product_modifications: ProductModification[] | null;
  stock_by_pickup_point?: Array<{ quantity: number }> | null;
  [key: string]: any;
}

export interface StockData {
  modificationStock: Record<string, number>;
  productStock: Record<string, number>;
}

/**
 * Calculates product availability using the same logic as RPC get_stock_info:
 * is_available = total_quantity > 0 OR stock_status = 'on_order'
 */
export function calculateProductAvailability(
  product: RawProduct,
  stockData: StockData
): boolean {
  const mods = product.product_modifications || [];
  const hasModifications = product.has_modifications ?? true;

  if (hasModifications && mods.length > 0) {
    // For products with modifications: check if ANY modification is available
    return mods.some((m) => {
      const modQty = stockData.modificationStock[m.id] || 0;
      return modQty > 0 || m.stock_status === "on_order";
    });
  } else {
    // For simple products: check product stock from inline data or stockData
    const inlineStock = (product.stock_by_pickup_point || [])
      .reduce((sum, s) => sum + (s.quantity || 0), 0);
    const productQty = stockData.productStock[product.id] || inlineStock;
    return productQty > 0 || product.stock_status === "on_order";
  }
}

/**
 * Fetches modification property values
 */
export async function fetchModificationPropertyValues(
  modificationIds: string[]
): Promise<Record<string, any[]>> {
  if (modificationIds.length === 0) return {};

  const { data } = await supabase
    .from("modification_property_values")
    .select("modification_id, property_id, value, numeric_value, option_id")
    .in("modification_id", modificationIds);

  const result: Record<string, any[]> = {};
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

/**
 * Enriches products with isAvailable field based on stock data
 */
export function enrichProductsWithAvailability<T extends RawProduct>(
  products: T[],
  modStockData: Record<string, number>
): (T & { isAvailable: boolean })[] {
  const stockData: StockData = {
    modificationStock: modStockData,
    productStock: {},
  };

  return products.map((product) => ({
    ...product,
    isAvailable: calculateProductAvailability(product, stockData),
  }));
}
