import type { z } from 'zod';
import { userCategories } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { CUSTOMER_CONFIG_LOCK } from '../customer-lock';
import { defineAdminResource } from '../resource';

/**
 * Категорії покупців (Е6в, Task 6). Insert/update — фабрика під
 * `CUSTOMER_CONFIG_LOCK` (Е6в-15).
 *
 * 🔴 `isDefault` — readonly: дефолт ставить іменована
 * `setDefaultUserCategoryOp`. 🔴 Фабричний `userCategoriesOps.remove`
 * serverFn-ом НЕ виставляється: видалення — лише `removeUserCategoriesOp`
 * (guarded, Е6в-18: дефолтна, покупці, правила, умова знижки).
 */
export const userCategoriesOps = defineAdminResource({
  entity: ENTITY.userCategories,
  table: userCategories,
  operation: 'customer.manage',
  mode: 'eager',
  filterable: ['id'],
  sortable: ['createdAt'],
  defaultOrder: { column: 'createdAt', direction: 'asc' },
  refine: {
    name: (s: z.ZodString) => s.trim().min(1).max(200),
    code: (s: z.ZodString) => s.trim().min(1),
    description: (s: z.ZodString) => s.max(2000),
  },
  writable: ['name', 'code', 'description', 'priceTypeId'],
  readonly: ['id', 'isDefault', 'createdAt'],
  lock: CUSTOMER_CONFIG_LOCK,
});
