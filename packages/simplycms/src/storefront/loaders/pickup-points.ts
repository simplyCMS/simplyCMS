import { asc, eq } from 'drizzle-orm';
import { pickupPoints } from 'simplycms/schema';
import type {
  Coordinates,
  PickupPoint,
  WorkingHours,
} from 'simplycms/contracts';
import type { ActorDb } from './db';

/** Точка видачі без опційної вкладеної зони — зона їде окремим списком. */
export type PickupPointRow = Omit<PickupPoint, 'zone'>;

/** Активні точки видачі — вибір самовивозу в чекауті. */
export async function loadPickupPoints(db: ActorDb): Promise<PickupPointRow[]> {
  const rows = await db
    .select()
    .from(pickupPoints)
    .where(eq(pickupPoints.isActive, true))
    .orderBy(asc(pickupPoints.sortOrder));

  return rows.map((row) => ({
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
  }));
}
