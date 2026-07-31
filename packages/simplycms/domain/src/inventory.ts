// Pure-розрахунок наявності товару. Перенесено з core/hooks/useProductsWithStock
// (тільки чисті функції; data-fetch лишається у data-шарі).

import type { StockData, ProductAvailabilityInput } from '@simplycms/objects';

export type { StockData, ProductAvailabilityInput } from '@simplycms/objects';

/**
 * Обчислює доступність товару тією ж логікою, що й RPC get_stock_info:
 * is_available = total_quantity > 0 OR stock_status = 'on_order'
 */
export function calculateProductAvailability(
  product: ProductAvailabilityInput,
  stockData: StockData,
): boolean {
  const mods = product.product_modifications || [];
  const hasModifications = product.has_modifications ?? true;

  if (hasModifications && mods.length > 0) {
    // Для товарів з модифікаціями: доступний, якщо доступна БУДЬ-ЯКА модифікація
    return mods.some((m) => {
      const modQty = stockData.modificationStock[m.id] || 0;
      return modQty > 0 || m.stock_status === 'on_order';
    });
  } else {
    // Для простих товарів: перевіряємо склад з inline-даних або stockData
    const inlineStock = (product.stock_by_pickup_point || []).reduce(
      (sum, s) => sum + (s.quantity || 0),
      0,
    );
    const productQty = stockData.productStock[product.id] || inlineStock;
    return productQty > 0 || product.stock_status === 'on_order';
  }
}

/**
 * Збагачує товари полем isAvailable на основі даних про склад.
 */
export function enrichProductsWithAvailability<
  T extends ProductAvailabilityInput,
>(
  products: T[],
  modStockData: Record<string, number>,
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
