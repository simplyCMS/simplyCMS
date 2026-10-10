/**
 * Нові товари сіду: рядок товару з зображеннями, модифікації за опціями
 * властивості розділу й значення властивостей — операціями фабрики.
 *
 * 🔴 Порядок обходу — порядок довідника (`catalog-data.mts`), а не id: PRNG
 * мусить споживатися однаково на кожному прогоні (С-6).
 */
import { randomUUID } from 'node:crypto';
import {
  modificationPropertyValuesOps,
  productModificationsOps,
  productPropertyValuesOps,
  productsOps,
} from '../../packages/simplycms/src/admin-server/impl/index.ts';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';
import { PROPERTIES, SECTIONS, type SectionSpec } from './catalog-data.mts';
import { uploadProductImages } from './images.mts';
import { int, pick, type Rand } from './prng.mts';
import { roundTo, type SeedContext } from './seed-context.mts';
import type { CatalogProduct, PropertyIds } from './catalog.mts';

export type ProductsInput = {
  readonly ctx: SeedContext;
  /** Потік даних товарів (рекомендований, бренд, числові значення). */
  readonly rand: Rand;
  /** Окремий потік картинок — кількість файлів не зсуває дані товарів. */
  readonly images: Rand;
  readonly sectionIds: ReadonlyMap<string, string>;
  readonly ids: PropertyIds;
};

const optionsOf = (slug: string) =>
  PROPERTIES.find((p) => p.slug === slug)?.options ?? [];

const idOf = (map: ReadonlyMap<string, string>, key: string): string => {
  const id = map.get(key);
  if (!id) throw new Error(`[showcase] немає id для «${key}»`);
  return id;
};

async function insertModifications(
  db: ActorDb,
  ids: PropertyIds,
  product: { id: string; sku: string },
  propertySlug: string,
): Promise<string[]> {
  const options = optionsOf(propertySlug);
  const rows = options.map(([slug, name], i) => ({
    id: randomUUID(),
    productId: product.id,
    slug,
    name,
    sku: `${product.sku}-${slug.toUpperCase()}`,
    sortOrder: i,
  }));
  await productModificationsOps.insertIn(db, rows);
  await modificationPropertyValuesOps.insertIn(
    db,
    rows.map((row, i) => ({
      id: randomUUID(),
      modificationId: row.id,
      propertyId: idOf(ids.property, propertySlug),
      optionId: idOf(ids.option, `${propertySlug}/${options[i]![0]}`),
    })),
  );
  return rows.map((row) => row.id);
}

/** Значення властивостей товару: бренд (опція) і числова, якщо є. */
function productValues(
  rand: Rand,
  ids: PropertyIds,
  section: SectionSpec,
  productId: string,
) {
  const brand = pick(rand, optionsOf('brend'))[0];
  const values: Record<string, unknown>[] = [
    {
      id: randomUUID(),
      productId,
      propertyId: idOf(ids.property, 'brend'),
      optionId: idOf(ids.option, `brend/${brand}`),
    },
  ];
  if (section.numeric) {
    const { slug, min, max } = section.numeric;
    const step = max >= 1000 ? 100 : 5;
    values.push({
      id: randomUUID(),
      productId,
      propertyId: idOf(ids.property, slug),
      numericValue: String(roundTo(int(rand, min, max), step)),
    });
  }
  return values;
}

export async function insertProducts(
  db: ActorDb,
  input: ProductsInput,
): Promise<CatalogProduct[]> {
  const { ctx, rand, images, sectionIds, ids } = input;
  const created: CatalogProduct[] = [];
  for (const section of SECTIONS) {
    for (const [n, spec] of section.products.entries()) {
      const id = randomUUID();
      const sku = `${section.skuPrefix}-${String(n + 1).padStart(3, '0')}`;
      const refs = await uploadProductImages(
        db,
        ctx,
        images,
        id,
        int(images, 1, 2),
      );
      await productsOps.insertIn(db, [
        {
          id,
          sectionId: idOf(sectionIds, section.slug),
          slug: spec.slug,
          name: spec.name,
          shortDescription: spec.short,
          description: `<p>${spec.short} Гарантія 24 місяці.</p>`,
          isActive: true,
          isFeatured: rand() < 0.2,
          images: refs,
          hasModifications: Boolean(section.modProperty),
          sku,
          stockStatus: 'in_stock',
        },
      ]);
      await productPropertyValuesOps.insertIn(
        db,
        productValues(rand, ids, section, id),
      );
      const modificationIds = section.modProperty
        ? await insertModifications(db, ids, { id, sku }, section.modProperty)
        : [];
      created.push({
        productId: id,
        slug: spec.slug,
        section,
        modificationIds,
      });
    }
  }
  return created;
}
