import {
  modificationPropertyValues,
  productPropertyValues,
} from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Значення властивостей — ЛИШЕ ЧИТАННЯ колекцій (М1, Task 17): пише команда агрегата
 * `products.saveDescription` разом з перекладом тексту. Форму рядка тримає БД (Р18:
 * складені FK, CHECK колонки, частковий UNIQUE скаляра), а текст `value_kind = text`
 * без рядка основної мови не комітиться (І5) — узагальнений insert його не пише.
 */
const VALUE_COLUMNS = [
  'id',
  'propertyId',
  'valueKind',
  'optionId',
  'numericValue',
  'boolValue',
  'colorValue',
  'createdAt',
] as const;

export const productPropertyValuesOps = defineAdminResource({
  entity: ENTITY.productPropertyValues,
  table: productPropertyValues,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['productId', 'propertyId'],
  sortable: ['createdAt'],
  writable: [],
  readonly: [...VALUE_COLUMNS, 'productId'],
});

export const modificationPropertyValuesOps = defineAdminResource({
  entity: ENTITY.modificationPropertyValues,
  table: modificationPropertyValues,
  operation: 'catalog.write',
  mode: 'on-demand',
  filterable: ['modificationId', 'propertyId'],
  sortable: ['createdAt'],
  writable: [],
  readonly: [...VALUE_COLUMNS, 'modificationId'],
});
