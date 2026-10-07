import type { z } from 'zod';
import { discountGroups } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { DISCOUNT_CONFIG_LOCK } from '../discount-lock';
import { boundDiscountDate } from '../discounts/save-input';
import { defineAdminResource } from '../resource';
import { guardDiscountGroups } from './guards';

/**
 * Групи знижок (Е6в, Task 5). Insert/update — фабрика під
 * `DISCOUNT_CONFIG_LOCK` із guard-ом циклу й пари дат (Е6в-17, ред.2).
 * 🔴 Фабричний `discountGroupsOps.remove` serverFn-ом НЕ виставляється:
 * видалення — лише `removeDiscountGroupsOp` (під локом, повертає все
 * видалене піддерево для write-back).
 */
export const discountGroupsOps = defineAdminResource({
  entity: ENTITY.discountGroups,
  table: discountGroups,
  operation: 'discount.manage',
  mode: 'eager',
  filterable: ['id', 'parentGroupId'],
  sortable: ['priority'],
  defaultOrder: { column: 'priority', direction: 'asc' },
  refine: {
    name: (s: z.ZodString) => s.trim().min(1).max(200),
    description: (s: z.ZodString) => s.max(2000),
    startsAt: boundDiscountDate,
    endsAt: boundDiscountDate,
  },
  writable: [
    'name',
    'description',
    'operator',
    'isActive',
    'priority',
    'startsAt',
    'endsAt',
    'parentGroupId',
  ],
  readonly: ['id', 'createdAt', 'updatedAt'],
  touch: 'updatedAt',
  lock: DISCOUNT_CONFIG_LOCK,
  guard: guardDiscountGroups,
});
