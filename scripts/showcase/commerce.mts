/**
 * Торгівля сіду (С-4, С-14): другий тип ціни «Оптова», ціни обох типів і
 * залишки у двох точках УСІМ товарам (новим і демо), адресна доставка з
 * тарифом і друга точка видачі. Деталі — `prices.mts`, `shipping.mts`.
 */
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { priceTypesOps } from '../../packages/simplycms/src/admin-server/impl/index.ts';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';
import { priceTypes } from '../../packages/simplycms/src/schema/index.ts';
import type { CatalogProduct } from './catalog.mts';
import { seedPrices, type SaleTarget } from './prices.mts';
import { stream } from './seed-context.mts';
import { seedShipping, seedStock, type ShippingIds } from './shipping.mts';

export type { SaleTarget } from './prices.mts';

async function retailPriceTypeId(db: ActorDb): Promise<string> {
  const [row] = await db
    .select({ id: priceTypes.id })
    .from(priceTypes)
    .where(eq(priceTypes.isDefault, true));
  if (!row) throw new Error('[showcase] немає типу ціни за замовчуванням');
  return row.id;
}

export type CommerceResult = {
  readonly wholesaleId: string;
  readonly targets: readonly SaleTarget[];
  readonly shipping: ShippingIds;
};

export async function seedCommerce(
  db: ActorDb,
  catalog: readonly CatalogProduct[],
): Promise<CommerceResult> {
  const retailId = await retailPriceTypeId(db);
  const wholesaleId = randomUUID();
  await priceTypesOps.insertIn(db, [
    { id: wholesaleId, name: 'Оптова', code: 'wholesale', sortOrder: 1 },
  ]);
  const targets = await seedPrices(db, catalog, retailId, wholesaleId);
  const shipping = await seedShipping(db);
  await seedStock(db, stream('stock'), targets, shipping);
  return { wholesaleId, targets, shipping };
}
