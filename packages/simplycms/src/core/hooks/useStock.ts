import { useQuery } from '@tanstack/react-query';
import type { StockStatus } from 'simplycms/contracts';
import type { Translator } from 'simplycms/i18n';
import {
  getActivePickupPoints,
  getPickupPointsCount,
  getStockInfo,
} from '../lib/stock';

export type { StockStatus };
export type {
  StockByPointRow as StockByPoint,
  StockInfoRow as StockInfo,
} from '../lib/stock';

/**
 * Наявність товару або обраної модифікації.
 *
 * 🔴 Заміна браузерного `rpc('get_stock_info')`: такої функції в схемі v2
 * немає, тож блок наявності на картці товару просто не мав що показати.
 * Тепер залишок рахує SQL під анонімним актором вітрини, а розкладка по
 * точках видачі відсіює вимкнені точки (див. `loadStockInfo`).
 */
export function useStock(
  productId?: string | null,
  modificationId?: string | null,
) {
  return useQuery({
    queryKey: ['stock-info', modificationId ?? null, productId ?? null],
    queryFn: () =>
      getStockInfo({
        data: {
          productId: modificationId ? null : (productId ?? null),
          modificationId: modificationId ?? null,
        },
      }),
    enabled: !!(productId || modificationId),
    staleTime: 30 * 1000,
  });
}

/** Скільки точок видачі активні — заміна `rpc('get_active_pickup_points_count')`. */
export function usePickupPointsCount() {
  return useQuery({
    queryKey: ['pickup-points-count'],
    queryFn: () => getPickupPointsCount(),
    staleTime: 60 * 1000,
  });
}

/** Активні точки видачі — довідник самовивозу. */
export function usePickupPoints() {
  return useQuery({
    queryKey: ['active-pickup-points'],
    queryFn: () => getActivePickupPoints(),
    staleTime: 60 * 1000,
  });
}

// Helper to check availability based on stock status
export function isProductAvailable(
  stockStatus: StockStatus | null,
  totalQuantity: number,
): boolean {
  if (stockStatus === 'on_order') return true;
  if (stockStatus === 'in_stock') return totalQuantity > 0;
  return false;
}

// Status display helpers.
// 🔴 `getStockStatusLabel` — не хук (викликається з ternary/мап поза
// компонентом), тому `useT()` тут заборонений — транслятор приймає параметром,
// як і решта не-хук функцій у пакеті (див. CLAUDE-інструкцію проєкту з i18n).
export function getStockStatusLabel(
  status: StockStatus | null,
  t: Translator,
): string {
  switch (status) {
    case 'in_stock':
      return t('product.inStock');
    case 'out_of_stock':
      return t('product.outOfStock');
    case 'on_order':
      return t('product.onOrder');
    default:
      return t('product.stockUnknown');
  }
}

// Кольорові класи ні від локалі, ні від t() не залежать — сигнатура незмінна.
export function getStockStatusColor(status: StockStatus | null): string {
  switch (status) {
    case 'in_stock':
      return 'text-green-600';
    case 'out_of_stock':
      return 'text-destructive';
    case 'on_order':
      return 'text-amber-600';
    default:
      return 'text-muted-foreground';
  }
}
