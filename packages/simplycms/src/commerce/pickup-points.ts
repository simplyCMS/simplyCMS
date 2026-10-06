import { and, asc, eq } from 'drizzle-orm';
import { pickupPoints } from 'simplycms/schema';
import type {
  Coordinates,
  PickupPoint,
  WorkingHours,
} from 'simplycms/contracts';
import type { ActorDb } from 'simplycms/db';

/** Точка видачі без опційної вкладеної зони — зона їде окремим списком. */
export type PickupPointRow = Omit<PickupPoint, 'zone'>;

/** Активні точки видачі — вибір самовивозу в чекауті. */
export async function loadPickupPoints(db: ActorDb): Promise<PickupPointRow[]> {
  const rows = await db
    .select()
    .from(pickupPoints)
    .where(eq(pickupPoints.isActive, true))
    .orderBy(asc(pickupPoints.sortOrder));

  return rows.map(toPickupPointRow);
}

/**
 * Активна точка видачі за id, що належить САМЕ цьому способу самовивозу
 * (точка іншого способу — `null`, а не чужа адреса в замовленні).
 */
export async function loadPickupPoint(
  db: ActorDb,
  pointId: string,
  methodId: string,
): Promise<PickupPointRow | null> {
  const [row] = await db
    .select()
    .from(pickupPoints)
    .where(
      and(
        eq(pickupPoints.id, pointId),
        eq(pickupPoints.methodId, methodId),
        eq(pickupPoints.isActive, true),
      ),
    )
    .limit(1);
  return row ? toPickupPointRow(row) : null;
}

function toPickupPointRow(
  row: typeof pickupPoints.$inferSelect,
): PickupPointRow {
  return {
    id: row.id,
    method_id: row.methodId,
    name: row.name,
    address: row.address,
    city: row.city,
    zone_id: row.zoneId,
    working_hours: (row.workingHours ?? {}) as WorkingHours,
    phone: row.phone,
    is_active: row.isActive,
    is_system: row.isSystem,
    sort_order: row.sortOrder,
    coordinates: (row.coordinates ?? null) as Coordinates | null,
    created_at: row.createdAt,
  };
}
