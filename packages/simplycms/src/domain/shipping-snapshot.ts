// Розбір знімка доставки з `orders.shipping_data` (Е6а-8/19). Ручний type-guard
// без Zod: T1 не тягне Zod, а запис знімка будує серверний код, тож валідація
// потрібна лише читачам, які мусять пережити сміття в jsonb (старі рядки, `{}`).

import {
  SHIPPING_PRICINGS,
  isShippingProviderId,
  type ShippingPricing,
  type ShippingDestination,
  type ShippingSnapshot,
} from 'simplycms/contracts/shipping-providers';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isPricing(x: unknown): x is ShippingPricing {
  return (
    typeof x === 'string' &&
    (SHIPPING_PRICINGS as readonly string[]).includes(x)
  );
}

function parseDestination(d: unknown): ShippingDestination | null {
  if (!isRecord(d)) return null;
  if (d.kind === 'address') {
    // `null` — знеособлена адреса (Е6г-10); інший не-рядок — сміття.
    if (d.city !== null && typeof d.city !== 'string') return null;
    if (d.address !== null && typeof d.address !== 'string') return null;
    return { kind: 'address', city: d.city, address: d.address };
  }
  if (d.kind === 'pickup-point') {
    const { pointId, name, address, city } = d;
    if (
      typeof pointId !== 'string' ||
      typeof name !== 'string' ||
      typeof address !== 'string' ||
      typeof city !== 'string'
    ) {
      return null;
    }
    return { kind: 'pickup-point', pointId, name, address, city };
  }
  return null;
}

/** Невалідне значення (включно з `{}`) дає `null`, без throw. */
export function parseShippingSnapshot(json: unknown): ShippingSnapshot | null {
  if (!isRecord(json)) return null;
  const { methodName, provider, pricing } = json;
  if (typeof methodName !== 'string') return null;
  if (typeof provider !== 'string' || !isShippingProviderId(provider))
    return null;
  if (!isPricing(pricing)) return null;
  const destination = parseDestination(json.destination);
  if (!destination) return null;
  return { methodName, provider, pricing, destination };
}
