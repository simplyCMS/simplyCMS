import { supabase } from '@/integrations/supabase/client';
import { ShippingZone } from './types';

/**
 * Find the most specific shipping zone for a customer city
 * Zones are checked in order of sort_order (priority)
 * Returns default zone if no specific match found
 */
export async function findShippingZone(
  customerCity: string
): Promise<ShippingZone | null> {
  // Fetch all active zones
  const { data: zones, error } = await supabase
    .from('shipping_zones')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error || !zones) {
    console.error('Error fetching shipping zones:', error);
    return null;
  }

  const normalized = normalizeString(customerCity);

  // Find matching zone by city
  for (const zone of zones) {
    const zoneData = zone as unknown as ShippingZone;
    
    // Skip default zone for now (it's fallback)
    if (zoneData.is_default) continue;

    // Check if customer city matches any zone city
    const cities = zoneData.cities || [];
    if (cities.some(city => normalizeString(city) === normalized)) {
      return zoneData;
    }

    // Check regions if provided
    const regions = zoneData.regions || [];
    if (regions.some(region => normalizeString(region) === normalized)) {
      return zoneData;
    }
  }

  // Return default zone if exists
  const defaultZone = zones.find(z => (z as unknown as ShippingZone).is_default);
  return defaultZone as unknown as ShippingZone || null;
}

/**
 * Normalize string for comparison
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
