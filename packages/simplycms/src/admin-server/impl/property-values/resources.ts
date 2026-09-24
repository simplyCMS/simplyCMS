import {
  modificationPropertyValues,
  productPropertyValues,
} from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Значення властивостей — автозбереження на зміну (Е3-11): фабричні
 * insert/update/remove. Унікальність тримає БД: (власник, властивість,
 * опція) NULLS NOT DISTINCT — скалярна властивість має рівно один рядок
 * (option_id NULL), multiselect — рядок на кожну обрану опцію (Е3-13).
 */
export const productPropertyValuesOps = defineAdminResource({
  entity: ENTITY.productPropertyValues,
  table: productPropertyValues,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['productId', 'propertyId'],
  sortable: ['createdAt'],
  writable: ['productId', 'propertyId', 'value', 'numericValue', 'optionId'],
  readonly: ['id', 'createdAt'],
});

export const modificationPropertyValuesOps = defineAdminResource({
  entity: ENTITY.modificationPropertyValues,
  table: modificationPropertyValues,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['modificationId', 'propertyId'],
  sortable: ['createdAt'],
  writable: [
    'modificationId',
    'propertyId',
    'value',
    'numericValue',
    'optionId',
  ],
  readonly: ['id', 'createdAt'],
});
