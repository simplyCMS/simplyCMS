import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  ADMIN_STATE_CONSTRAINT,
  stateConflict,
} from 'simplycms/contracts/domain-errors';
import { SYSTEM_ORDER_STATUS_CODES } from 'simplycms/contracts/order-status-codes';
import { assertVersionThenHash, defineOperation } from 'simplycms/operations';
import { orderStatuses } from 'simplycms/schema';
import { lockRoot } from '../translatable/roots';
import { expectedVersion } from '../translatable/wire';
import { ORDER_STATUS_ROOT } from './root';

/**
 * 🔴 remove для ЦІЄЇ сутності — іменований: «не видалити дефолтний» — доменний інваріант,
 * який частковий індекс не покриває (він забороняє ДВА дефолти, не НУЛЬ). Корінь одразу
 * `FOR UPDATE` (DELETE однаково бере його): конкурентний `setDefault` чекає й не зробить
 * рядок дефолтним між перевіркою і видаленням. Системні коди (Е5-6) тримають скасування
 * замовлення. Посилання з `orders` дає FK 23503 → 409 `reference` на межі операції.
 * Переклади статусу зникають каскадом.
 */
export const orderStatusesRemove = defineOperation({
  id: 'order-statuses.remove',
  permission: 'catalog.write',
  input: z.object({ id: z.uuid(), expectedVersion }),
  output: z.object({ id: z.uuid() }),
  async run({ db }, input) {
    const version = await lockRoot(db, ORDER_STATUS_ROOT, input.id, 'update');
    assertVersionThenHash(version, input.expectedVersion, () => undefined);
    const [row] = await db
      .select({ code: orderStatuses.code, isDefault: orderStatuses.isDefault })
      .from(orderStatuses)
      .where(eq(orderStatuses.id, input.id));
    if (row!.isDefault)
      stateConflict(ADMIN_STATE_CONSTRAINT.orderStatusDefault);
    if (SYSTEM_ORDER_STATUS_CODES.includes(row!.code))
      stateConflict(ADMIN_STATE_CONSTRAINT.orderStatusSystem);
    await db.delete(orderStatuses).where(eq(orderStatuses.id, input.id));
    return { id: input.id };
  },
});
