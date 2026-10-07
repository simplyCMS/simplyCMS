import type { z } from 'zod';
import { categoryRules } from 'simplycms/schema';
import { ENTITY } from 'simplycms/contracts/entities';
import { parseCategoryRuleConditions } from 'simplycms/domain';
import { CUSTOMER_CONFIG_LOCK } from '../customer-lock';
import { defineAdminResource } from '../resource';
import { guardCategoryRules } from './guards';

/**
 * Автоправила категорій покупців (Е6в, Task 6). Insert/update — фабрика під
 * `CUSTOMER_CONFIG_LOCK` (Е6в-15) з guard-ом «не в ту саму категорію».
 *
 * 🔴 `conditions` — через `parseCategoryRuleConditions` (Е6в-19): порожнє
 * правило, оператор поза переліком поля (ред.5) чи нечислове значення
 * числового поля — 400 на межі. Той самий розбір рушій застосовує при
 * читанні, тож рядок, вписаний в обхід Zod, не спрацює. Записується
 * результат розбору (нормалізовані текстові значення, F7).
 * Remove — фабричний: видалення правила інваріантів не ламає (FK історії —
 * `SET NULL`).
 */
export const categoryRulesOps = defineAdminResource({
  entity: ENTITY.categoryRules,
  table: categoryRules,
  operation: 'customer.manage',
  mode: 'eager',
  filterable: ['id', 'fromCategoryId', 'toCategoryId'],
  sortable: ['priority'],
  defaultOrder: { column: 'priority', direction: 'desc' },
  refine: {
    name: (s: z.ZodString) => s.trim().min(1).max(200),
    description: (s: z.ZodString) => s.max(2000),
    // F7: у БД лягає РОЗІБРАНА форма — текстові значення вже `trim` +
    // нижній регістр, зайві ключі відкинуті, хоч би що надіслав клієнт.
    conditions: (s: z.ZodType) =>
      s
        .refine((value) => parseCategoryRuleConditions(value) !== null, {
          message: 'невалідні умови правила',
        })
        .transform((value) => parseCategoryRuleConditions(value) ?? value),
  },
  writable: [
    'name',
    'description',
    'fromCategoryId',
    'toCategoryId',
    'conditions',
    'isActive',
    'priority',
  ],
  readonly: ['id', 'createdAt'],
  lock: CUSTOMER_CONFIG_LOCK,
  guard: guardCategoryRules,
});
