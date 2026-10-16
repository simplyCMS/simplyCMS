/**
 * Нові товари сіду: товар, його модифікації за опціями властивості розділу,
 * значення властивостей і зображення — КОМАНДАМИ агрегата (М1, Task 12):
 * `products.create` + `products.saveDescription`. Тож модифікації мають мовні
 * токени, значення — вид, а фото — рядки `product_images` із файлами товару.
 *
 * 🔴 Порядок обходу — порядок довідника (`catalog-data.mts`), а не id: PRNG
 * мусить споживатися однаково на кожному прогоні (С-6).
 */
import { randomUUID } from 'node:crypto';
import {
  productsCreate,
  productsSaveDescription,
} from '../../packages/simplycms/src/admin-server/impl/index.ts';
import type { ActorDb } from '../../packages/simplycms/src/db/index.ts';
import { PROPERTIES, SECTIONS, type SectionSpec } from './catalog-data.mts';
import { runCommand } from './command.mts';
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

/** Модифікації за опціями властивості + їхні значення (мова — основна, `uk`). */
function modificationsOf(
  ids: PropertyIds,
  product: { sku: string },
  propertySlug: string,
) {
  const options = optionsOf(propertySlug);
  const upsert = options.map(([slug, name], i) => ({
    id: randomUUID(),
    sku: `${product.sku}-${slug.toUpperCase()}`,
    sortOrder: i,
    texts: { uk: { name } },
    token: { uk: slug },
  }));
  const values = upsert.map((row, i) => ({
    id: randomUUID(),
    modificationId: row.id,
    propertyId: idOf(ids.property, propertySlug),
    kind: 'select' as const,
    optionId: idOf(ids.option, `${propertySlug}/${options[i]![0]}`),
  }));
  return { upsert, values };
}

/** Значення властивостей товару: бренд (опція) і числова, якщо є. */
function productValues(
  rand: Rand,
  ids: PropertyIds,
  section: SectionSpec,
): Record<string, unknown>[] {
  const brand = pick(rand, optionsOf('brend'))[0];
  const values: Record<string, unknown>[] = [
    {
      id: randomUUID(),
      propertyId: idOf(ids.property, 'brend'),
      kind: 'select',
      optionId: idOf(ids.option, `brend/${brand}`),
    },
  ];
  if (section.numeric) {
    const { slug, min, max } = section.numeric;
    const step = max >= 1000 ? 100 : 5;
    values.push({
      id: randomUUID(),
      propertyId: idOf(ids.property, slug),
      kind: 'number',
      number: String(roundTo(int(rand, min, max), step)),
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
      const featured = rand() < 0.2;
      const { version } = await runCommand(db, productsCreate, {
        id,
        sectionId: idOf(sectionIds, section.slug),
        sku,
        isActive: true,
        isFeatured: featured,
        hasModifications: Boolean(section.modProperty),
        stockStatus: 'in_stock',
        path: spec.slug,
        texts: {
          uk: {
            name: spec.name,
            shortDescription: spec.short,
            description: `<p>${spec.short} Гарантія 24 місяці.</p>`,
          },
        },
      });
      const mods = section.modProperty
        ? modificationsOf(ids, { sku }, section.modProperty)
        : null;
      await runCommand(db, productsSaveDescription, {
        id,
        expectedVersion: version,
        propertyValues: {
          upsert: [
            ...productValues(rand, ids, section),
            ...(mods?.values ?? []),
          ],
        },
        ...(mods && { modifications: { upsert: mods.upsert } }),
        images: {
          upsert: refs.map((storageKey, sortOrder) => ({
            id: randomUUID(),
            storageKey,
            sortOrder,
          })),
        },
      });
      created.push({
        productId: id,
        slug: spec.slug,
        section,
        modificationIds: mods?.upsert.map((m) => m.id) ?? [],
      });
    }
  }
  return created;
}
