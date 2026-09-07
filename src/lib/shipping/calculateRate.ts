import { ShippingRate, ShippingCalculationContext, ShippingCalculationResult } from './types';
import { hookRegistry } from '@/lib/plugins/HookRegistry';

/**
 * Calculate shipping cost based on rate configuration
 */
export function calculateShippingCost(
  rate: ShippingRate,
  context: ShippingCalculationContext
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
      return rate.base_cost + (weight * perKgCost);
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
 * Calculate shipping for a method, considering zone and rates
 */
export async function calculateShipping(
  context: ShippingCalculationContext,
  rates: ShippingRate[]
): Promise<ShippingCalculationResult | null> {
  const { method, zone } = context;
  
  // For plugin methods, use hook to calculate
  if (method.type === 'plugin') {
    const results = await hookRegistry.execute<ShippingCalculationContext, ShippingCalculationResult>(
      'checkout.shipping.rates',
      context
    );
    
    if (results.length > 0) {
      return results[0];
    }
    return null;
  }
  
  // For system/manual methods, find applicable rate
  const applicableRates = rates
    .filter(r => r.method_id === method.id && r.is_active)
    .filter(r => !zone || r.zone_id === zone.id)
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
 * Format shipping cost for display
 */
export function formatShippingCost(cost: number | null): string {
  if (cost === null || cost < 0) {
    return 'За тарифами';
  }
  if (cost === 0) {
    return 'Безкоштовно';
  }
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
  }).format(cost);
}
