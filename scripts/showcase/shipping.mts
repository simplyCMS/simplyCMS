/**
 * Доставка й залишки сіду (С-4, С-14): адресний спосіб (`core:address`, режим
 * `rates`) із тарифом у дефолтній зоні демо, друга точка видачі й залишки
 * кожної позиції в обох точках.
 *
 * 🔴 Системна точка й спосіб самовивозу — з демо-сіду (шукаються за ознакою,
 * а не константою id); нове — операціями фабрики й ядром `saveStock`.
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  pickupPointsOps,
  saveStock,
  saveStockInput,
  shippingMethodsOps,
  shippingRatesOps,
} from '../../packages/simplycms/src/admin-server/impl/index.ts';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';
import {
  pickupPoints,
  shippingMethods,
  shippingZones,
} from '../../packages/simplycms/src/schema/index.ts';
import type { SaleTarget } from './commerce.mts';
import { int, type Rand } from './prng.mts';

export type ShippingIds = {
  /** Самовивіз демо-сіду (`core:pickup`). */
  readonly pickupMethodId: string;
  /** Новий адресний спосіб (`core:address`). */
  readonly courierMethodId: string;
  /** Системна точка демо (склад у Києві). */
  readonly systemPointId: string;
  /** Нова точка видачі. */
  readonly secondPointId: string;
};

async function one<T>(rows: Promise<T[]>, what: string): Promise<T> {
  const [row] = await rows;
  if (!row) throw new Error(`[showcase] демо-сід не має: ${what}`);
  return row;
}

export async function seedShipping(db: ActorDb): Promise<ShippingIds> {
  const pickup = await one(
    db
      .select({ id: shippingMethods.id })
      .from(shippingMethods)
      .where(eq(shippingMethods.code, 'pickup')),
    'спосіб самовивозу',
  );
  const system = await one(
    db
      .select({ id: pickupPoints.id })
      .from(pickupPoints)
      .where(eq(pickupPoints.isSystem, true)),
    'системна точка',
  );
  const zone = await one(
    db
      .select({ id: shippingZones.id })
      .from(shippingZones)
      .where(eq(shippingZones.isDefault, true)),
    'дефолтна зона',
  );
  const courierMethodId = randomUUID();
  await shippingMethodsOps.insertIn(db, [
    {
      id: courierMethodId,
      code: 'courier',
      name: "Кур'єрська доставка",
      description: 'Доставка на адресу по всій Україні',
      provider: 'core:address',
      pricing: 'rates',
      isActive: true,
      sortOrder: 1,
    },
  ]);
  await shippingRatesOps.insertIn(db, [
    {
      id: randomUUID(),
      methodId: courierMethodId,
      zoneId: zone.id,
      name: "Кур'єр по Україні",
      calculationType: 'flat',
      baseCost: '150.00',
      estimatedDays: '1–3 дні',
      isActive: true,
      sortOrder: 0,
    },
  ]);
  const secondPointId = randomUUID();
  await pickupPointsOps.insertIn(db, [
    {
      id: secondPointId,
      methodId: pickup.id,
      name: 'Магазин у Львові',
      address: 'вул. Городоцька, 15',
      city: 'Львів',
      phone: '+380322345678',
      isActive: true,
      sortOrder: 1,
    },
  ]);
  return {
    pickupMethodId: pickup.id,
    courierMethodId,
    systemPointId: system.id,
    secondPointId,
  };
}

/**
 * Залишки кожної позиції в обох точках. Запас із PRNG свідомо щедрий: ~40
 * замовлень сіду не мусять вичерпати жодну позицію, інакше оформлення
 * відмовило б `not_purchasable`, і знімок залежав би від порядку списань.
 */
export async function seedStock(
  db: ActorDb,
  rand: Rand,
  targets: readonly SaleTarget[],
  ids: ShippingIds,
): Promise<void> {
  for (const target of targets) {
    const input = saveStockInput.parse({
      productId: target.modificationId ? null : target.productId,
      modificationId: target.modificationId,
      quantities: [
        { pickupPointId: ids.systemPointId, quantity: int(rand, 20, 60) },
        { pickupPointId: ids.secondPointId, quantity: int(rand, 12, 40) },
      ],
    });
    await saveStock(db, input);
  }
}
