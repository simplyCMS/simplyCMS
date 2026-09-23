import {
  priceTypes,
  propertyOptions,
  sectionProperties,
  sectionPropertyAssignments,
  sections,
} from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Довідники, які картка товару ЧИТАЄ, а керуються вони в Е4 (Е3-1).
 * writable порожній — serverFn запису не виставляються; exhaustiveness
 * фабрики змушує перелічити ВСІ колонки в readonly, тож нова колонка в
 * схемі червонить typecheck тут, а не зникає мовчки з адмінки.
 * Операція — catalog.write (Е3-6): адмінка бачить неактивні розділи.
 */
export const sectionsReadOps = defineAdminResource({
  entity: ENTITY.sections,
  table: sections,
  operation: 'catalog.write',
  mode: 'eager',
  filterable: ['id', 'parentId', 'isActive'],
  sortable: ['name', 'sortOrder'],
  defaultOrder: { column: 'name', direction: 'asc' },
  writable: [],
  readonly: [
    'id',
    'slug',
    'name',
    'description',
    'imageUrl',
    'parentId',
    'sortOrder',
    'isActive',
    'metaTitle',
    'metaDescription',
    'createdAt',
    'updatedAt',
  ],
});

export const priceTypesReadOps = defineAdminResource({
  entity: ENTITY.priceTypes,
  table: priceTypes,
  operation: 'catalog.write',
  mode: 'eager',
  filterable: ['id'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: [],
  readonly: ['id', 'name', 'code', 'isDefault', 'sortOrder', 'createdAt'],
});

export const sectionPropertyAssignmentsReadOps = defineAdminResource({
  entity: ENTITY.sectionPropertyAssignments,
  table: sectionPropertyAssignments,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['sectionId', 'appliesTo'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: [],
  readonly: [
    'id',
    'sectionId',
    'propertyId',
    'sortOrder',
    'createdAt',
    'appliesTo',
  ],
});

export const sectionPropertiesReadOps = defineAdminResource({
  entity: ENTITY.sectionProperties,
  table: sectionProperties,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['id'],
  sortable: ['sortOrder', 'name'],
  writable: [],
  readonly: [
    'id',
    'sectionId',
    'name',
    'slug',
    'propertyType',
    'isRequired',
    'isFilterable',
    'hasPage',
    'sortOrder',
    'options',
    'createdAt',
  ],
});

export const propertyOptionsReadOps = defineAdminResource({
  entity: ENTITY.propertyOptions,
  table: propertyOptions,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['propertyId'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  writable: [],
  readonly: [
    'id',
    'propertyId',
    'name',
    'slug',
    'sortOrder',
    'createdAt',
    'description',
    'imageUrl',
    'metaTitle',
    'metaDescription',
  ],
});
