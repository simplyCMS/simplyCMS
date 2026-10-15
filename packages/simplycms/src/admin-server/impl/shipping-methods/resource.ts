import type { z } from 'zod';
import { shippingMethods } from 'simplycms/schema';
import { PRICE_TYPE_CODE_RE } from 'simplycms/domain';
import { ENTITY } from 'simplycms/contracts/entities';
import { defineAdminResource } from '../resource';
import { guardShippingMethods } from './guards';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';

/**
 * Способи доставки (Е6а, Task 4).
 *
 * 🔴 Е6а-7: `provider` — `insertOnly`: зміна провайдера осиротила б точки й
 * тарифи. Е6а-12: провайдер із реєстру і режим `provider` лише з
 * `supportsQuote` перевіряє `guardShippingMethods` під `LOCK_KEYS.shippingConfig`.
 * 🔴 Фабричний `shippingMethodsOps.remove` serverFn-ом НЕ виставляється:
 * видалення — лише `removeShippingMethodsOp` (під локом, Е6а-17).
 */
export const shippingMethodsOps = defineAdminResource({
  entity: ENTITY.shippingMethods,
  table: shippingMethods,
  operation: 'shipping.manage',
  mode: 'eager',
  filterable: ['id'],
  sortable: ['sortOrder'],
  defaultOrder: { column: 'sortOrder', direction: 'asc' },
  refine: { code: (s: z.ZodString) => s.regex(PRICE_TYPE_CODE_RE) },
  writable: [
    'code',
    'name',
    'description',
    'pricing',
    'isActive',
    'sortOrder',
    'icon',
    'config',
  ],
  insertOnly: ['provider'],
  readonly: ['id', 'createdAt', 'updatedAt'],
  touch: 'updatedAt',
  lock: LOCK_KEYS.shippingConfig,
  guard: guardShippingMethods,
});
