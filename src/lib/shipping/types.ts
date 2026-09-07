// Shipping system types

export type ShippingMethodType = 'system' | 'manual' | 'plugin';
export type ShippingCalculationType = 'flat' | 'weight' | 'order_total' | 'free_from' | 'plugin';

export interface ShippingMethod {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: ShippingMethodType;
  plugin_name: string | null;
  is_active: boolean;
  sort_order: number;
  config: Record<string, unknown>;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  description: string | null;
  cities: string[];
  regions: string[];
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  // Joined data
  rates?: ShippingRate[];
}

export interface ShippingRate {
  id: string;
  method_id: string;
  zone_id: string;
  name: string;
  calculation_type: ShippingCalculationType;
  base_cost: number;
  per_kg_cost: number | null;
  min_weight: number | null;
  free_from_amount: number | null;
  min_order_amount: number | null;
  max_order_amount: number | null;
  estimated_days: string | null;
  is_active: boolean;
  sort_order: number;
  config: Record<string, unknown>;
  created_at: string;
  // Joined data
  method?: ShippingMethod;
  zone?: ShippingZone;
}

export interface PickupPoint {
  id: string;
  method_id: string;
  name: string;
  address: string;
  city: string;
  zone_id: string | null;
  working_hours: WorkingHours;
  phone: string | null;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  coordinates: Coordinates | null;
  created_at: string;
  // Joined data
  zone?: ShippingZone;
}

export interface WorkingHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

// Calculation context for plugin hooks
export interface ShippingCalculationContext {
  method: ShippingMethod;
  zone: ShippingZone | null;
  cart: {
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
      weight?: number;
    }>;
    subtotal: number;
    totalWeight?: number;
  };
  customer?: {
    city?: string;
    address?: string;
  };
}

// Result from shipping calculation
export interface ShippingCalculationResult {
  methodId: string;
  zoneId: string | null;
  rateId: string | null;
  cost: number;
  estimatedDays: string | null;
  pluginData?: Record<string, unknown>;
}

// Form data for shipping selection
export interface ShippingFormData {
  methodId: string;
  rateId?: string;
  pickupPointId?: string;
  city?: string;
  address?: string;
  pluginData?: Record<string, unknown>;
}
