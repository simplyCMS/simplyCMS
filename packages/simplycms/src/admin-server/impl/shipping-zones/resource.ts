import { and, eq, inArray } from 'drizzle-orm';
import { shippingZones } from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { ENTITY } from 'simplycms/contracts/entities';
import type { ActorDb } from 'simplycms/db';
import { stateConflict } from '../errors';
import { defineAdminResource } from '../resource';
import type { ResourceGuardWrite } from '../resource-config';
import { SHIPPING_CONFIG_LOCK } from '../shipping-lock';

/**
 * Е6а-20: дефолтну зону не можна деактивувати — довідник бере лише активні
 * зони, і вимкнена дефолтна мовчки лишила б без доставки всі міста поза
 * зонами. Insert дефолтних зон не створює (`isDefault` — readonly).
 */
async function guardShippingZones(
  db: ActorDb,
  write: ResourceGuardWrite<unknown, { isActive?: boolean }>,
): Promise<void> {
  if (write.kind === 'insert') return;
  const ids = write.updates
    .filter((u) => u.patch.isActive === false)
    .map((u) => u.id);
  if (ids.length === 0) return;
  const [hit] = await db
    .select({ id: shippingZones.id })
    .from(shippingZones)
    .where(
      and(inArray(shippingZones.id, ids), eq(shippingZones.isDefault, true)),
    );
  if (hit) stateConflict(ADMIN_STATE_CONSTRAINT.shippingZoneDefault);
}

/**
 * Зони доставки (Е6а, Task 4). 🔴 `isDefault` — readonly для фабрики:
 * дефолт ставить `setDefaultShippingZoneOp`, видалення — лише
 * `removeShippingZonesOp` (обидві під `SHIPPING_CONFIG_LOCK`); фабричний
 * `remove` serverFn-ом НЕ виставляється.
 */
export const shippingZonesOps = defineAdminResource({
  entity: ENTITY.shippingZones,
  table: shippingZones,
  operation: 'shipping.manage',
  mode: 'eager',
  filterable: ['id'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: [
    'name',
    'description',
    'isActive',
    'sortOrder',
    'cities',
    'regions',
  ],
  readonly: ['id', 'isDefault', 'createdAt'],
  lock: SHIPPING_CONFIG_LOCK,
  guard: guardShippingZones,
});
