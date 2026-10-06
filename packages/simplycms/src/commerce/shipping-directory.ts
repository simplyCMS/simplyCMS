import { asc, eq } from 'drizzle-orm';
import {
  shippingMethods,
  shippingRates,
  shippingZones,
} from 'simplycms/schema';
import { isShippingProviderId } from 'simplycms/contracts/shipping-providers';
import type { ActorDb } from 'simplycms/db';
import type { JsonValue } from 'simplycms/schema/types';
import { loadPickupPoints } from './pickup-points';
import type {
  ShippingDirectory,
  ShippingMethodRow,
  ShippingRateRow,
  ShippingZoneRow,
} from './shipping-types';

/**
 * Публічні довідники доставки — читаються під `app_user` БЕЗ ідентичності.
 *
 * 🔴 Фільтр `is_active` тут ОБОВʼЯЗКОВИЙ і є частиною контракту, а не
 * оптимізацією. RLS на цих таблицях не ввімкнено (грант `select` для
 * `app_user` — `0002_grants.sql`), політики «публічне читання» в новій
 * моделі немає, тож видимість чернеток тримає рівно цей предикат. Забути
 * його означає показати покупцю вимкнений спосіб доставки — і дати оформити
 * замовлення на неіснуючий тариф.
 */
export async function loadShippingDirectory(
  db: ActorDb,
): Promise<ShippingDirectory> {
  // Послідовно: усі чотири вибірки живуть в одній транзакції актора.
  const methods = await loadShippingMethods(db);
  const zones = await loadShippingZones(db);
  const rates = await loadShippingRates(db);
  const points = await loadPickupPoints(db);

  return { methods, zones, rates, pickupPoints: points };
}

/** Активні способи доставки в порядку показу. */
export async function loadShippingMethods(
  db: ActorDb,
): Promise<ShippingMethodRow[]> {
  // 🔴 Колонки перелічено явно: `config` у публічний довідник не потрапляє (Е6а-13).
  const rows = await db
    .select({
      id: shippingMethods.id,
      code: shippingMethods.code,
      name: shippingMethods.name,
      description: shippingMethods.description,
      provider: shippingMethods.provider,
      pricing: shippingMethods.pricing,
      isActive: shippingMethods.isActive,
      sortOrder: shippingMethods.sortOrder,
      icon: shippingMethods.icon,
      createdAt: shippingMethods.createdAt,
      updatedAt: shippingMethods.updatedAt,
    })
    .from(shippingMethods)
    .where(eq(shippingMethods.isActive, true))
    .orderBy(asc(shippingMethods.sortOrder));

  // Колонка `provider` — `text`: спосіб із невідомим провайдером чекаут не
  // вміє обслужити (куди везти?), тож його не показують.
  return rows.flatMap((row) =>
    isShippingProviderId(row.provider)
      ? [
          {
            id: row.id,
            code: row.code,
            name: row.name,
            description: row.description,
            provider: row.provider,
            pricing: row.pricing,
            is_active: row.isActive,
            sort_order: row.sortOrder,
            icon: row.icon,
            created_at: row.createdAt,
            updated_at: row.updatedAt,
          },
        ]
      : [],
  );
}

/** Активні зони доставки — за ними домен резолвить місто покупця. */
export async function loadShippingZones(
  db: ActorDb,
): Promise<ShippingZoneRow[]> {
  const rows = await db
    .select()
    .from(shippingZones)
    .where(eq(shippingZones.isActive, true))
    .orderBy(asc(shippingZones.sortOrder));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    cities: row.cities ?? [],
    regions: row.regions ?? [],
    is_active: row.isActive,
    is_default: row.isDefault,
    sort_order: row.sortOrder,
    created_at: row.createdAt,
  }));
}

/**
 * Активні тарифи.
 *
 * 🔴 Грошові колонки — `numeric`, тобто драйвер віддає їх РЯДКАМИ. Контракт
 * `ShippingRate` обіцяє числа, і без явного `Number` порівняння з порогом
 * (`subtotal >= free_from_amount`) мовчки стало б лексикографічним.
 */
export async function loadShippingRates(
  db: ActorDb,
): Promise<ShippingRateRow[]> {
  const rows = await db
    .select()
    .from(shippingRates)
    .where(eq(shippingRates.isActive, true))
    .orderBy(asc(shippingRates.sortOrder));

  return rows.map((row) => ({
    id: row.id,
    method_id: row.methodId,
    zone_id: row.zoneId,
    name: row.name,
    calculation_type: row.calculationType,
    base_cost: Number(row.baseCost),
    per_kg_cost: toNumberOrNull(row.perKgCost),
    min_weight: toNumberOrNull(row.minWeight),
    free_from_amount: toNumberOrNull(row.freeFromAmount),
    min_order_amount: toNumberOrNull(row.minOrderAmount),
    max_order_amount: toNumberOrNull(row.maxOrderAmount),
    estimated_days: row.estimatedDays,
    is_active: row.isActive,
    sort_order: row.sortOrder,
    config: (row.config ?? {}) as Record<string, JsonValue>,
    created_at: row.createdAt,
  }));
}

/** `numeric` → число або `null` (порожня колонка лишається порожньою). */
function toNumberOrNull(value: string | null): number | null {
  return value === null ? null : Number(value);
}
