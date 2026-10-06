import { inArray } from 'drizzle-orm';
import { shippingMethods } from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import {
  SHIPPING_PROVIDERS,
  isShippingProviderId,
  type ShippingPricing,
} from 'simplycms/contracts/shipping-providers';
import type { ActorDb } from 'simplycms/db';
import { stateConflict } from '../errors';
import type { ResourceGuardWrite } from '../resource-config';

type MethodWrite = ResourceGuardWrite<
  { provider: string; pricing?: ShippingPricing },
  { pricing?: ShippingPricing }
>;

/** Провайдер — з реєстру ядра; режим `provider` — лише в того, хто вміє квоту. */
function assertProviderPricing(provider: string, pricing?: ShippingPricing) {
  if (!isShippingProviderId(provider))
    stateConflict(ADMIN_STATE_CONSTRAINT.shippingProviderUnknown);
  if (pricing === 'provider' && !SHIPPING_PROVIDERS[provider].supportsQuote)
    stateConflict(ADMIN_STATE_CONSTRAINT.shippingPricingUnsupported);
}

/**
 * Guard способів доставки (Е6а-12, Е6а-16) — під `SHIPPING_CONFIG_LOCK`, над
 * усім пакетом. Insert несе `provider` у рядку; update — ні (`insertOnly`),
 * тож для patch із `pricing: 'provider'` провайдер читається з БД.
 * Рушій (`resolveShippingRate`) для недосяжного режиму повертає `null` —
 * сервер не дає його записати, а не лише UI.
 */
export async function guardShippingMethods(
  db: ActorDb,
  write: MethodWrite,
): Promise<void> {
  if (write.kind === 'insert') {
    for (const row of write.rows)
      assertProviderPricing(row.provider, row.pricing);
    return;
  }
  const ids = write.updates
    .filter((u) => u.patch.pricing === 'provider')
    .map((u) => u.id);
  if (ids.length === 0) return;
  const rows = await db
    .select({ provider: shippingMethods.provider })
    .from(shippingMethods)
    .where(inArray(shippingMethods.id, ids));
  for (const row of rows) assertProviderPricing(row.provider, 'provider');
}
