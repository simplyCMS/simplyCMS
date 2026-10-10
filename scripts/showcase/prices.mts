/**
 * Ціни сіду (С-4, С-14): роздрібна й «Оптова» кожній позиції — новим товарам
 * із PRNG за діапазоном розділу, демо-товарам — їхня роздрібна з демо-сіду
 * без змін плюс оптова (−10%).
 *
 * 🔴 Ядро `saveProductPrices` довіряє розібраному входу — вхід іде через його
 * ж схему `saveProductPricesInput`. Набір пари замінюється атомарно, тож
 * демо-ціна переписується тією самою сумою.
 */
import { asc, eq } from 'drizzle-orm';
import {
  saveProductPrices,
  saveProductPricesInput,
} from '../../packages/simplycms/src/admin-server/impl/index.ts';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';
import {
  productModifications,
  productPrices,
  products,
} from '../../packages/simplycms/src/schema/index.ts';
import type { CatalogProduct } from './catalog.mts';
import { int, type Rand } from './prng.mts';
import { money, roundTo, stream } from './seed-context.mts';

/** Позиція, яку можна покласти в кошик: товар або його модифікація. */
export type SaleTarget = {
  /** `slug` чи `slug/модифікація` — стабільний ключ порядку (С-6). */
  readonly key: string;
  readonly productId: string;
  readonly modificationId: string | null;
};

type PricePair = {
  readonly target: SaleTarget;
  readonly retail: number;
  readonly oldPrice: number | null;
};

const wholesaleOf = (retail: number) => roundTo(retail * 0.9, 10);

/** Ціни нових товарів: база з діапазону розділу, варіанти дорожчають. */
function newPrices(
  rand: Rand,
  catalog: readonly CatalogProduct[],
): PricePair[] {
  return catalog.flatMap((p): PricePair[] => {
    const [lo, hi] = p.section.price;
    const base = roundTo(int(rand, lo, hi), hi >= 10000 ? 100 : 10);
    const oldPrice = rand() < 0.25 ? roundTo(base * 1.15, 10) : null;
    if (p.modificationIds.length === 0)
      return [
        {
          target: { key: p.slug, productId: p.productId, modificationId: null },
          retail: base,
          oldPrice,
        },
      ];
    return p.modificationIds.map((modificationId, i) => ({
      target: { key: `${p.slug}/${i}`, productId: p.productId, modificationId },
      retail: roundTo(base * (1 + 0.5 * i), 10),
      oldPrice: null,
    }));
  });
}

/** Роздрібні ціни демо-сіду (товар чи модифікація) — у порядку slug. */
async function demoPrices(db: ActorDb, retailId: string): Promise<PricePair[]> {
  const rows = await db
    .select({
      productId: productPrices.productId,
      modificationId: productPrices.modificationId,
      slug: products.slug,
      modSlug: productModifications.slug,
      price: productPrices.price,
      oldPrice: productPrices.oldPrice,
    })
    .from(productPrices)
    .innerJoin(products, eq(products.id, productPrices.productId))
    .leftJoin(
      productModifications,
      eq(productModifications.id, productPrices.modificationId),
    )
    .where(eq(productPrices.priceTypeId, retailId))
    .orderBy(asc(products.slug), asc(productModifications.slug));
  return rows.map((r) => ({
    target: {
      key: r.modSlug ? `${r.slug}/${r.modSlug}` : r.slug,
      productId: r.productId,
      modificationId: r.modificationId,
    },
    retail: Number(r.price),
    oldPrice: r.oldPrice === null ? null : Number(r.oldPrice),
  }));
}

/**
 * Ціни обох типів усім позиціям; повертає позиції в кодовому порядку ключа.
 * 🔴 Демо-ціни читаються ДО запису нових — нових рядків серед них ще немає.
 */
export async function seedPrices(
  db: ActorDb,
  catalog: readonly CatalogProduct[],
  retailId: string,
  wholesaleId: string,
): Promise<SaleTarget[]> {
  const pairs = [
    ...newPrices(stream('prices'), catalog),
    ...(await demoPrices(db, retailId)),
  ];
  for (const { target, retail, oldPrice } of pairs) {
    const input = saveProductPricesInput.parse({
      productId: target.productId,
      modificationId: target.modificationId,
      prices: [
        {
          priceTypeId: retailId,
          price: money(retail),
          oldPrice: oldPrice === null ? null : money(oldPrice),
        },
        {
          priceTypeId: wholesaleId,
          price: money(wholesaleOf(retail)),
          oldPrice: null,
        },
      ],
    });
    await saveProductPrices(db, input);
  }
  // Кодовий порядок рядків, не `localeCompare`: той залежить від ICU машини.
  return pairs.map((p) => p.target).sort((a, b) => (a.key < b.key ? -1 : 1));
}
