import { shippingRates } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Тарифи доставки (Е6а-1, Task 4): редагуються в картці способу, тож
 * читаються on-demand за способом (`methodId`) чи зоною.
 *
 * 🔴 `methodId`/`zoneId` — `insertOnly`: тариф не переїжджає між способами
 * й зонами, перенос — це новий тариф. Інваріантів запису в тарифів немає,
 * тож ні `lock`, ні `guard`; видалення — generic `remove` фабрики БЕЗ локу
 * (Е6а-22, прецедент `sectionsOps.remove`).
 */
export const shippingRatesOps = defineAdminResource({
  entity: ENTITY.shippingRates,
  table: shippingRates,
  operation: 'shipping.manage',
  mode: 'on-demand',
  filterable: ['methodId', 'zoneId'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: [
    'name',
    'calculationType',
    'baseCost',
    'perKgCost',
    'minWeight',
    'freeFromAmount',
    'minOrderAmount',
    'maxOrderAmount',
    'estimatedDays',
    'isActive',
    'sortOrder',
    'config',
  ],
  insertOnly: ['methodId', 'zoneId'],
  readonly: ['id', 'createdAt'],
});
