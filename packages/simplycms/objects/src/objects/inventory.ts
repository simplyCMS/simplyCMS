// Доменні типи наявності/складу. Винесено з core/hooks/useStock + useProductsWithStock.

export type StockStatus = "in_stock" | "out_of_stock" | "on_order";

export interface StockByPoint {
  point_id: string;
  point_name: string;
  quantity: number;
}

/** Агрегована інформація про наявність товару/модифікації. */
export interface StockInfo {
  totalQuantity: number;
  isAvailable: boolean;
  stockStatus: StockStatus | null;
  byPoint: StockByPoint[];
}

/** Кеш кількостей для pure-розрахунку доступності. */
export interface StockData {
  modificationStock: Record<string, number>;
  productStock: Record<string, number>;
}

/** Мінімальний контракт товару для pure-розрахунку доступності. */
export interface ProductAvailabilityInput {
  id: string;
  stock_status: string | null;
  has_modifications?: boolean | null;
  product_modifications?: Array<{
    id: string;
    stock_status: string | null;
    is_default: boolean;
    sort_order: number;
  }> | null;
  stock_by_pickup_point?: Array<{ quantity: number }> | null;
  [key: string]: unknown;
}
