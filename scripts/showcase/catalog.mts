/**
 * Каталог сіду (С-4, С-14): розділи з властивостями, товари з модифікаціями й
 * зображеннями — усе через операції фабрики (`*Ops.insertIn/updateIn`), тобто
 * з тими самими схемами, локами й guard-ами, що й адмінка.
 *
 * 🔴 Демо-товари не переписуються: їм лише додаються зображення (`updateIn`).
 */
import { randomUUID } from 'node:crypto';
import { asc, notInArray } from 'drizzle-orm';
import {
  productsOps,
  propertyOptionsOps,
  sectionPropertiesOps,
  sectionPropertyAssignmentsOps,
  sectionsOps,
} from '../../packages/simplycms/src/admin-server/impl/index.ts';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';
import { products } from '../../packages/simplycms/src/schema/index.ts';
import { PROPERTIES, SECTIONS, type SectionSpec } from './catalog-data.mts';
import { insertProducts } from './catalog-products.mts';
import { uploadProductImages } from './images.mts';
import type { Rand } from './prng.mts';
import { stream, type SeedContext } from './seed-context.mts';

/** Товар, якому `commerce` дає ціни й залишки, а `orders` — продає. */
export type CatalogProduct = {
  readonly productId: string;
  readonly slug: string;
  readonly section: SectionSpec;
  /** Модифікації в порядку опцій властивості; порожньо — товар без них. */
  readonly modificationIds: readonly string[];
};

/** Id властивостей і опцій за slug — для призначень і значень. */
export type PropertyIds = {
  readonly property: ReadonlyMap<string, string>;
  /** `<slug властивості>/<slug опції>` → id опції. */
  readonly option: ReadonlyMap<string, string>;
};

async function insertStructure(db: ActorDb): Promise<{
  sectionIds: ReadonlyMap<string, string>;
  ids: PropertyIds;
}> {
  const sectionIds = new Map(SECTIONS.map((s) => [s.slug, randomUUID()]));
  await sectionsOps.insertIn(
    db,
    SECTIONS.map((s, i) => ({
      id: sectionIds.get(s.slug),
      slug: s.slug,
      name: s.name,
      description: `<p>${s.description}</p>`,
      sortOrder: 30 + i * 10,
      isActive: true,
    })),
  );
  const property = new Map(PROPERTIES.map((p) => [p.slug, randomUUID()]));
  await sectionPropertiesOps.insertIn(
    db,
    PROPERTIES.map((p, i) => ({
      id: property.get(p.slug),
      name: p.name,
      slug: p.slug,
      propertyType: p.type,
      isFilterable: true,
      sortOrder: i,
    })),
  );
  const option = new Map<string, string>();
  const options = PROPERTIES.flatMap((p) =>
    p.options.map(([slug, name], i) => {
      const id = randomUUID();
      option.set(`${p.slug}/${slug}`, id);
      return { id, propertyId: property.get(p.slug), name, slug, sortOrder: i };
    }),
  );
  await propertyOptionsOps.insertIn(db, options);
  // Бренд — у кожному новому розділі; числова — у товарах свого розділу;
  // властивість модифікацій — на рівні варіанта (`appliesTo: modification`).
  const assignments = SECTIONS.flatMap((s) =>
    [
      ['brend', 'product'],
      ...(s.numeric ? [[s.numeric.slug, 'product']] : []),
      ...(s.modProperty ? [[s.modProperty, 'modification']] : []),
    ].map(([slug, appliesTo], i) => ({
      id: randomUUID(),
      sectionId: sectionIds.get(s.slug),
      propertyId: property.get(slug!),
      appliesTo,
      sortOrder: i,
    })),
  );
  await sectionPropertyAssignmentsOps.insertIn(db, assignments);
  return { sectionIds, ids: { property, option } };
}

/** Зображення восьми демо-товарам (С-14) — у порядку slug, не id (С-6). */
async function imagesForDemo(
  db: ActorDb,
  ctx: SeedContext,
  rand: Rand,
  newIds: string[],
): Promise<void> {
  const demo = await db
    .select({ id: products.id })
    .from(products)
    .where(notInArray(products.id, newIds))
    .orderBy(asc(products.slug));
  for (const { id } of demo) {
    const images = await uploadProductImages(db, ctx, rand, id, 1);
    await productsOps.updateIn(db, [{ id, patch: { images } }]);
  }
}

/** Весь каталог сіду в транзакції викликача (`withActor` адміна). */
export async function seedCatalog(
  db: ActorDb,
  ctx: SeedContext,
): Promise<CatalogProduct[]> {
  const { sectionIds, ids } = await insertStructure(db);
  const images = stream('images');
  const created = await insertProducts(db, {
    ctx,
    rand: stream('catalog'),
    images,
    sectionIds,
    ids,
  });
  await imagesForDemo(
    db,
    ctx,
    images,
    created.map((p) => p.productId),
  );
  return created;
}
