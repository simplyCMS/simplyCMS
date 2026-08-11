// Pure-розрахунок доставки. Перенесено з core/lib/shipping/calculateRate
// (findZone лишається у data-шарі — він робить IO; домен працює з готовими rates/zone).

import type {
  ConfigProvider,
  ShippingRate,
  ShippingCalculationContext,
  ShippingCalculationResult,
} from '@simplycms/objects';
import { formatPrice } from './money';

export type {
  ShippingMethod,
  ShippingMethodType,
  ShippingCalculationType,
  ShippingZone,
  ShippingRate,
  PickupPoint,
  WorkingHours,
  Coordinates,
  ShippingCalculationContext,
  ShippingCalculationResult,
  ShippingFormData,
} from '@simplycms/objects';

/**
 * Розраховує вартість доставки за конфігурацією тарифу.
 * Повертає -1, якщо тариф недоступний для цього замовлення.
 */
export function calculateShippingCost(
  rate: ShippingRate,
  context: ShippingCalculationContext,
): number {
  const { cart } = context;

  // Check order amount limits
  if (rate.min_order_amount && cart.subtotal < rate.min_order_amount) {
    return -1; // Rate not available for this order
  }
  if (rate.max_order_amount && cart.subtotal > rate.max_order_amount) {
    return -1; // Rate not available for this order
  }

  switch (rate.calculation_type) {
    case 'flat':
      return rate.base_cost;

    case 'weight': {
      const weight = cart.totalWeight || 0;
      if (rate.min_weight && weight < rate.min_weight) {
        return rate.base_cost;
      }
      const perKgCost = rate.per_kg_cost || 0;
      return rate.base_cost + weight * perKgCost;
    }

    case 'order_total': {
      // Percentage of order total (base_cost is percentage)
      return (cart.subtotal * rate.base_cost) / 100;
    }

    case 'free_from': {
      if (rate.free_from_amount && cart.subtotal >= rate.free_from_amount) {
        return 0;
      }
      return rate.base_cost;
    }

    case 'plugin':
      // Plugin rates are calculated via hooks
      return -1;

    default:
      return rate.base_cost;
  }
}

/**
 * Розраховує доставку для методу з урахуванням зони й тарифів.
 */
export async function calculateShipping(
  context: ShippingCalculationContext,
  rates: ShippingRate[],
): Promise<ShippingCalculationResult | null> {
  const { method, zone } = context;

  // For plugin methods, skip hook-based calculation in this package
  // (host app can integrate with its own plugin system)
  if (method.type === 'plugin') {
    return null;
  }

  // For system/manual methods, find applicable rate
  const applicableRates = rates
    .filter((r) => r.method_id === method.id && r.is_active)
    .filter((r) => !zone || r.zone_id === zone.id)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (applicableRates.length === 0) {
    return null;
  }

  // Find first rate that works for this order
  for (const rate of applicableRates) {
    const cost = calculateShippingCost(rate, context);
    if (cost >= 0) {
      return {
        methodId: method.id,
        zoneId: zone?.id || null,
        rateId: rate.id,
        cost,
        estimatedDays: rate.estimated_days,
      };
    }
  }

  return null;
}

/**
 * Підписи для двох НЕ-числових станів вартості доставки.
 *
 * 🔴 Передаються параметром, а не беруться з i18n усередині: `@simplycms/domain`
 * це тір T1 (pure-логіка, нуль залежностей крім `objects`), а `@simplycms/i18n`
 * — T2. Імпорт транслятора сюди був би ребром ВГОРУ по тірах. Тому домен
 * володіє ЛОГІКОЮ (нуль → безкоштовно, `null`/відʼємне → за тарифами), а
 * текстом володіє кол-сайт: `t('common.shipping.free')` тощо.
 */
export interface ShippingCostLabels {
  /** Вартість невідома наперед — рахується за тарифами перевізника. */
  byTariff: string;
  /** Доставка безкоштовна. */
  free: string;
}

/**
 * Форматує вартість доставки для відображення.
 *
 * 🔴 `config` — обов'язковий (без дефолту), як і в `formatPrice`: це чиста
 * T1-функція без доступу до `useEngine()`, тож локаль/валюту зобов'язаний
 * передати кол-сайт (React-компонент бере їх з `useEngine().config`).
 * Дефолт на кшталт `{ locale: 'uk-UA', currency: 'UAH' }` тут був би тим самим
 * хардкодом, який цей модуль лагодить: магазин з іншою конфігурацією
 * (`simplycms.config.ts`) мовчки отримав би не свою валюту.
 * Раніше форматування йшло через `new Intl.NumberFormat('uk-UA', { style:
 * 'currency', currency: 'UAH', minimumFractionDigits: 0 })` — дефолти
 * `formatPrice` (0/2) відтворюють цей виклик побайтово (перевірено тестами).
 *
 * 🔴 `labels` теж обов'язкові: до 2026-08-09 функція повертала «За тарифами» і
 * «Безкоштовно» рядковими літералами, і саме через це англомовний магазин
 * показував українську вартість доставки в підсумку замовлення. Дефолт
 * повернув би той самий дефект мовчки.
 */
export function formatShippingCost(
  cost: number | null,
  config: Pick<ConfigProvider, 'locale' | 'currency'>,
  labels: ShippingCostLabels,
): string {
  if (cost === null || cost < 0) {
    return labels.byTariff;
  }
  if (cost === 0) {
    return labels.free;
  }
  return formatPrice(cost, config);
}

/**
 * Знаходить найбільш специфічну зону доставки для міста клієнта
 * серед уже завантажених зон (pure-частина findShippingZone).
 * IO (запит зон) виконує CatalogRepository.getShippingZones.
 */
export function findShippingZoneIn<
  Z extends {
    cities?: string[];
    regions?: string[];
    is_default: boolean;
  },
>(zones: Z[], customerCity: string): Z | null {
  const normalized = normalizeString(customerCity);

  for (const zone of zones) {
    if (zone.is_default) continue;
    const cities = zone.cities || [];
    if (cities.some((city) => normalizeString(city) === normalized)) {
      return zone;
    }
    const regions = zone.regions || [];
    if (regions.some((region) => normalizeString(region) === normalized)) {
      return zone;
    }
  }

  return zones.find((z) => z.is_default) || null;
}

function normalizeString(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}
