import { orderStatusTranslations, orderStatuses } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * ЛИШЕ ЧИТАННЯ колекції (М2б, Р19): статус створюють і правлять команди агрегата
 * `order-statuses.*` (`commands.ts`, `set-default.ts`, `reorder.ts`, `remove.ts`) — вони
 * піднімають `version`, а узагальнений запис фабрики його не знає. Назва статусу — з
 * перекладу основної мови (INNER JOIN, `resource-read-model.ts`); дзеркальної колонки немає.
 *
 * `createdAt` прихований: рядок списку без часових відбитків (Д10); `isDefault` лише
 * читається — інваріант «дефолт рівно один» тримає `setDefault`, `code` незмінний (на ньому
 * тримаються скасування покупцем і адмінкою, `simplycms/contracts/order-status-codes`).
 */
export const orderStatusesOps = defineAdminResource({
  entity: ENTITY.orderStatuses,
  table: orderStatuses,
  operation: 'catalog.write',
  mode: 'eager',
  filterable: ['code', 'isDefault'],
  sortable: ['sortOrder', 'name'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  readModel: {
    translations: orderStatusTranslations,
    owner: orderStatusTranslations.statusId,
    fields: { name: orderStatusTranslations.name },
    required: ['name'],
  },
  writable: [],
  readonly: ['id', 'code', 'color', 'sortOrder', 'isDefault', 'version'],
  omit: ['createdAt'],
});
