import { asc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { shippingZones } from 'simplycms/schema';
import { ADMIN_STATE_CONSTRAINT } from 'simplycms/contracts/domain-errors';
import { lockCatalogTarget } from '../catalog-lock';
import { stateConflict } from '../errors';
import { runAdmin } from '../run';
import { assertAllFound, SHIPPING_CONFIG_LOCK } from '../shipping-lock';

export const removeShippingZonesInput = z
  .array(z.object({ id: z.uuid() }))
  .min(1)
  .max(100);

/**
 * Видалення зон доставки (Е6а-12) — guarded batch. «Не видалити дефолтну» —
 * доменний інваріант, якого частковий індекс не покриває (він забороняє ДВІ
 * дефолтні, не НУЛЬ).
 *  1. `SHIPPING_CONFIG_LOCK` — ПЕРШИЙ запит, той самий, що в
 *     `setDefaultShippingZoneOp`.
 *  2. `FOR UPDATE … ORDER BY id`; відсутній id — помилка, дефолтна серед них —
 *     `shipping_zone_default`; обидва відкочують увесь batch.
 *  3. DELETE (тарифи зони — cascade, точки — `zone_id = NULL`).
 */
export const removeShippingZonesOp = async ({
  data,
}: {
  data: z.infer<typeof removeShippingZonesInput>;
}) =>
  runAdmin('shipping.manage', async (db) => {
    await lockCatalogTarget(db, SHIPPING_CONFIG_LOCK);
    const ids = data.map((d) => d.id);
    const found = await db
      .select({ id: shippingZones.id, isDefault: shippingZones.isDefault })
      .from(shippingZones)
      .where(inArray(shippingZones.id, ids))
      .orderBy(asc(shippingZones.id))
      .for('update');
    assertAllFound('shipping_zones', ids, found);
    if (found.some((z) => z.isDefault))
      stateConflict(ADMIN_STATE_CONSTRAINT.shippingZoneDefault);
    const deleted = await db
      .delete(shippingZones)
      .where(inArray(shippingZones.id, ids))
      .returning({ id: shippingZones.id });
    return { count: deleted.length };
  });
