import { orderStatuses } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * 🔴 isDefault — у readonly: інваріант «дефолт рівно один» не проходить
 * через generic-write (форма сторінки має чекбокс — він кличе setDefault
 * ОКРЕМИМ викликом після insert/update). sortOrder — writable: клієнт
 * (eager-колекція = повна копія) рахує max+1 сам.
 */
export const orderStatusesOps = defineAdminResource({
  entity: ENTITY.orderStatuses,
  table: orderStatuses,
  operation: 'catalog.write',
  mode: 'eager',
  filterable: ['code', 'isDefault'],
  sortable: ['sortOrder', 'name'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: ['name', 'code', 'color', 'sortOrder'],
  readonly: ['id', 'isDefault', 'createdAt'],
});
