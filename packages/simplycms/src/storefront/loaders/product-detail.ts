import { and, eq } from 'drizzle-orm';
import {
  productModifications,
  productPrices,
  productPropertyValues,
  products,
  propertyOptions,
  sectionProperties,
  sections,
} from 'simplycms/schema';
import type { PriceEntry } from 'simplycms/contracts';
import type { ActorDb } from './db';
import {
  productColumns,
  toImageList,
  type ProductRow,
} from './entities/product';
import {
  modificationColumns,
  toModificationRow,
  type ModificationRow,
} from './entities/modification';
import { priceColumns, toPriceEntry } from './entities/price';
import { sectionRefColumns, type SectionRef } from './entities/section';
import { propertyValueColumns, toPropertyValueRow } from './property-values';
import type { ProductPropertyValueRow } from './property-values';

/** Товар сторінки картки разом з усіма приєднаними гілками. */
export type ProductDetailRow = ProductRow & {
  sections: SectionRef | null;
  product_modifications: ModificationRow[];
  product_prices: PriceEntry[];
  product_property_values: ProductPropertyValueRow[];
};

/**
 * Товар за slug — з розділом, модифікаціями, цінами й характеристиками.
 *
 * 🔴 `is_active = true` тут ОБОВʼЯЗКОВИЙ, хоч у старому коді його не було:
 * без нього чернетка товару відкривалася прямим посиланням і потрапляла в
 * JSON-LD. Клієнтський запит картки цей предикат мав завжди — тобто SSR і
 * гідрація давали різний результат на тому самому URL.
 */
export async function loadProduct(
  db: ActorDb,
  slug: string,
): Promise<ProductDetailRow | null> {
  const [row] = await db
    .select({ product: productColumns, section: sectionRefColumns })
    .from(products)
    .leftJoin(sections, eq(products.sectionId, sections.id))
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1);

  if (!row) return null;

  // Послідовно — причина та сама, що в `./products`: одне зʼєднання.
  const productId = row.product.id;
  const modificationRows = await db
    .select(modificationColumns)
    .from(productModifications)
    .where(eq(productModifications.productId, productId));
  const priceRows = await db
    .select(priceColumns)
    .from(productPrices)
    .where(eq(productPrices.productId, productId));
  const propertyValueRows = await db
    .select(propertyValueColumns)
    .from(productPropertyValues)
    .leftJoin(
      propertyOptions,
      eq(productPropertyValues.optionId, propertyOptions.id),
    )
    .leftJoin(
      sectionProperties,
      eq(productPropertyValues.propertyId, sectionProperties.id),
    )
    .where(eq(productPropertyValues.productId, productId));

  return {
    ...row.product,
    images: toImageList(row.product.images),
    // `leftJoin` без збігу дає рядок із порожнім `id` — розділ у товару
    // необовʼязковий (FK `on delete set null`), тож перевіряємо явно.
    sections: row.section?.id ? row.section : null,
    product_modifications: modificationRows.map(toModificationRow),
    product_prices: priceRows.map(toPriceEntry),
    product_property_values: propertyValueRows.map(toPropertyValueRow),
  };
}
