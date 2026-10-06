import { inArray } from 'drizzle-orm';
import { shippingMethods } from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import {
  SHIPPING_PROVIDERS,
  isShippingProviderId,
} from 'simplycms/contracts/shipping-providers';
import type { ActorDb } from 'simplycms/db';
import { stateConflict } from '../errors';
import type { ResourceGuardWrite } from '../resource-config';

/**
 * Guard точок видачі (Е6а-12, Е6а-16) — під `SHIPPING_CONFIG_LOCK`, над усім
 * пакетом: кожна точка належить способу, чий провайдер везе до точки
 * (`destination === 'pickup-point'`). Адресний, невідомий чи відсутній
 * спосіб — `pickup_point_method_invalid` для всього batch-у. Update не
 * перевіряється: `methodId` — `insertOnly`.
 */
export async function guardPickupPoints(
  db: ActorDb,
  write: ResourceGuardWrite<{ methodId: string }, unknown>,
): Promise<void> {
  if (write.kind === 'update') return;
  const ids = [...new Set(write.rows.map((r) => r.methodId))];
  const methods = await db
    .select({ id: shippingMethods.id, provider: shippingMethods.provider })
    .from(shippingMethods)
    .where(inArray(shippingMethods.id, ids));
  const pickup = new Set(
    methods
      .filter(
        (m) =>
          isShippingProviderId(m.provider) &&
          SHIPPING_PROVIDERS[m.provider].destination === 'pickup-point',
      )
      .map((m) => m.id),
  );
  if (ids.some((id) => !pickup.has(id)))
    stateConflict(ADMIN_STATE_CONSTRAINT.pickupPointMethodInvalid);
}
