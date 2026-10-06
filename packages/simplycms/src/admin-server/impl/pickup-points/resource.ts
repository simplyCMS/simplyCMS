import { pickupPoints } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';
import { SHIPPING_CONFIG_LOCK } from '../shipping-lock';
import { guardPickupPoints } from './guards';

/**
 * Точки видачі (Е6а, Task 4).
 *
 * 🔴 `isSystem` — readonly: системна точка — склад, з якого списують і на
 * який повертають (`inventory/stock-write.ts`). `methodId` — `insertOnly` і
 * перевіряється `guardPickupPoints` під `SHIPPING_CONFIG_LOCK`.
 * `workingHours`/`coordinates` — readonly: легасі їх теж не редагував
 * (поза Е6а). Фабричний `remove` serverFn-ом НЕ виставляється: видалення —
 * лише `removePickupPointsOp` (Е6а-17).
 */
export const pickupPointsOps = defineAdminResource({
  entity: ENTITY.pickupPoints,
  table: pickupPoints,
  operation: 'shipping.manage',
  mode: 'eager',
  filterable: ['methodId'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: [
    'name',
    'address',
    'city',
    'zoneId',
    'phone',
    'isActive',
    'sortOrder',
  ],
  insertOnly: ['methodId'],
  readonly: ['id', 'createdAt', 'isSystem', 'workingHours', 'coordinates'],
  lock: SHIPPING_CONFIG_LOCK,
  guard: guardPickupPoints,
});
