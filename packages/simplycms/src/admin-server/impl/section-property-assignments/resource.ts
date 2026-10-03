import { z } from 'zod';
import { sectionPropertyAssignments } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Призначення властивості розділу (Е4, Task 3), on-demand (Е4-9).
 *
 * 🔴 Е4-5: `sectionId`/`propertyId`/`appliesTo` — insertOnly. Пара
 * розділ/властивість унікальна незалежно від `appliesTo` (DDL), тож
 * «перемкнути на модифікації» — це видалення плюс створення.
 * `appliesTo` звужено до переліку CHECK-обмеження — недопустиме значення
 * відбивається схемою до транзакції, а не 23514 з бази.
 */
export const sectionPropertyAssignmentsOps = defineAdminResource({
  entity: ENTITY.sectionPropertyAssignments,
  table: sectionPropertyAssignments,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['sectionId', 'appliesTo', 'propertyId'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  refine: { appliesTo: () => z.enum(['product', 'modification']) },
  writable: ['sortOrder'],
  insertOnly: ['sectionId', 'propertyId', 'appliesTo'],
  readonly: ['id', 'createdAt'],
});
