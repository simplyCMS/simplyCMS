import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { shippingZones } from 'simplycms/schema';
import {
  ADMIN_STATE_CONSTRAINT,
  stateConflict,
} from 'simplycms/contracts/domain-errors';
import { lockCatalogTarget } from '../catalog-lock';
import { runAdmin } from '../run';
import { LOCK_KEYS } from 'simplycms/db/lock-keys';

export const setDefaultShippingZoneInput = z.object({ id: z.uuid() });

/**
 * Дефолтна (основна) зона доставки рівно одна й завжди активна (Е6а-12, Е6а-20;
 * інваріант тримає й БД — тригер `shipping_zones_require_default`): її бере
 * доставка за адресою і точка самовивозу без зони (`resolveShippingZone`).
 *
 * Порядок — патерн `price-types/set-default.ts`:
 *  1. `LOCK_KEYS.shippingConfig` — ПЕРШИЙ запит транзакції; той самий беруть
 *     `removeShippingZonesOp` і update зон (guard деактивації), тож ціль не
 *     зникне й не вимкнеться між читанням і UPDATE.
 *  2. Ціль `FOR UPDATE`; немає — помилка. Уже дефолтна — no-op.
 *     Неактивна — `shipping_zone_inactive`.
 *  3. Зняти дефолт з інших, ПОТІМ поставити цілі (зворотний порядок дав би
 *     два true під частковим unique-індексом → 23505).
 *  4. UPDATE цілі повернув 0 рядків — помилка й ROLLBACK.
 *
 * Повертає УСІ змінені рядки — колекція пише їх write-back-ом без refetch.
 */
export const setDefaultShippingZoneOp = async ({
  data,
}: {
  data: z.infer<typeof setDefaultShippingZoneInput>;
}) =>
  runAdmin('shipping.manage', async (db) => {
    await lockCatalogTarget(db, LOCK_KEYS.shippingConfig);
    const [target] = await db
      .select()
      .from(shippingZones)
      .where(eq(shippingZones.id, data.id))
      .for('update');
    if (!target)
      throw new Error(`[admin-server] зони доставки ${data.id} не існує`);
    if (target.isDefault) return { rows: [target] };
    if (!target.isActive)
      stateConflict(ADMIN_STATE_CONSTRAINT.shippingZoneInactive);
    const cleared = await db
      .update(shippingZones)
      .set({ isDefault: false })
      .where(
        and(eq(shippingZones.isDefault, true), ne(shippingZones.id, data.id)),
      )
      .returning();
    const [row] = await db
      .update(shippingZones)
      .set({ isDefault: true })
      .where(eq(shippingZones.id, data.id))
      .returning();
    if (!row)
      throw new Error(
        `[admin-server] зона доставки ${data.id} зникла під час призначення дефолту`,
      );
    return { rows: [...cleared, row] };
  });
