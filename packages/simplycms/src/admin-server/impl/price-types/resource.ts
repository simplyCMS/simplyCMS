import type { z } from 'zod';
import { priceTypes } from 'simplycms/schema';
import { PRICE_TYPE_CODE_RE } from 'simplycms/domain';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';

/**
 * Типи цін (Е4, Task 3).
 *
 * 🔴 Е4-2: `isDefault` — readonly для фабрики. Дефолт ставить іменована
 * `setDefaultPriceTypeOp`, видалення — іменована `removeManyPriceTypesOp`
 * (обидві під одним advisory-локом), тому фабричний `remove` для цієї
 * сутності serverFn-ом НЕ виставляється.
 * 🔴 Фабричний `priceTypesOps.remove` НЕ використовувати: він обходить і
 * advisory-лок, і заборону видалити дефолтний. Видалення типу ціни — лише
 * `removeManyPriceTypesOp` (guarded, Е4-2).
 * 🔴 Е4-7: формат коду перевіряє і сервер (`PRICE_TYPE_CODE_RE`).
 */
export const priceTypesOps = defineAdminResource({
  entity: ENTITY.priceTypes,
  table: priceTypes,
  operation: 'catalog.write',
  mode: 'eager',
  filterable: ['id'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  refine: { code: (s: z.ZodString) => s.regex(PRICE_TYPE_CODE_RE) },
  writable: ['name', 'code', 'sortOrder'],
  readonly: ['id', 'isDefault', 'createdAt'],
});
