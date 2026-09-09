import { asc, eq } from 'drizzle-orm';
import {
  shippingMethods,
  shippingRates,
  shippingZones,
} from 'simplycms/schema';
import type {
  ShippingMethod,
  ShippingRate,
  ShippingZone,
} from 'simplycms/contracts';
import type { ActorDb } from './db';
import type { JsonValue } from './entities/property';
import { loadPickupPoints, type PickupPointRow } from './pickup-points';

/**
 * Довідникові рядки доставки у формі, яку МОЖНА віддати serverFn-ом.
 *
 * 🔴 Різниця з контрактом рівно одна: `config` звужений із
 * `Record<string, unknown>` до JSON. Валідатор серіалізації TanStack Start
 * відкидає `unknown` — і правильно робить: «щось, що не вміє їхати по
 * дроту» в payload-і вітрини не має бути. Обидва рядки лишаються
 * присвоюваними доменним типам, тож `resolveShippingRate` бере їх як є.
 */
export type ShippingMethodRow = Omit<ShippingMethod, 'config'> & {
  config: Record<string, JsonValue>;
};

/** Зона без опційного `rates`: тарифи їдуть окремим списком, не вкладеними. */
export type ShippingZoneRow = Omit<ShippingZone, 'rates'>;

export type ShippingRateRow = Omit<
  ShippingRate,
  'config' | 'method' | 'zone'
> & {
  config: Record<string, JsonValue>;
};

/**
 * Довідники доставки у формі, яку споживає форма чекауту.
 *
 * 🔴 Одна структура, а не чотири окремі виклики: способи, зони, тарифи й
 * точки видачі потрібні формі ОДНОЧАСНО, і зібрані з різних знімків БД вони
 * дали б неможливий стан (тариф на зону, якої в списку вже немає).
 */
export interface ShippingDirectory {
  methods: ShippingMethodRow[];
  zones: ShippingZoneRow[];
  rates: ShippingRateRow[];
  pickupPoints: PickupPointRow[];
}

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
  const rows = await db
    .select()
    .from(shippingMethods)
    .where(eq(shippingMethods.isActive, true))
    .orderBy(asc(shippingMethods.sortOrder));

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    type: row.type,
    plugin_name: row.pluginName,
    is_active: row.isActive,
    sort_order: row.sortOrder,
    config: (row.config ?? {}) as Record<string, JsonValue>,
    icon: row.icon,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }));
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
