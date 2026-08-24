import { and, desc, eq, exists, or, sql } from 'drizzle-orm';
import {
  modificationPropertyValues,
  productModifications,
  productPropertyValues,
  products,
  propertyOptions,
  sectionProperties,
} from 'simplycms/schema';
import type { ActorDb } from './db';
import {
  productColumns,
  toImageList,
  type ProductRow,
} from './entities/product';
import {
  optionColumns,
  propertyColumns,
  toPropertyRow,
  type OptionRow,
  type PropertyRow,
} from './entities/property';

export interface PropertyOptionPageData {
  property: PropertyRow;
  option: OptionRow;
  products: ProductRow[];
}

/**
 * Сторінка значення характеристики: сама характеристика, її опція й товари.
 *
 * 🔴 Було три послідовні запити (характеристика → опція → товари), хоча
 * перші два — це один join: опція шукається за `property_id`, який той самий
 * запит і повертає. Лишилось два раундтрипи, і другий залежить від першого
 * по суті, а не через форму коду.
 */
export async function loadPropertyOption(
  db: ActorDb,
  propertySlug: string,
  optionSlug: string,
): Promise<PropertyOptionPageData | null> {
  const [row] = await db
    .select({ property: propertyColumns, option: optionColumns })
    .from(sectionProperties)
    .innerJoin(
      propertyOptions,
      eq(propertyOptions.propertyId, sectionProperties.id),
    )
    .where(
      and(
        eq(sectionProperties.slug, propertySlug),
        // Предикат видимості — див. `./properties`.
        eq(sectionProperties.hasPage, true),
        eq(propertyOptions.slug, optionSlug),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    property: toPropertyRow(row.property),
    option: row.option,
    products: await loadProductsByOption(db, row.option.id),
  };
}

/**
 * Товари, у яких опція стоїть на самому товарі АБО на будь-якій його
 * модифікації.
 *
 * 🔴 Обидва рівні, хоч старий серверний запит брав лише модифікаційний:
 * клієнтський запит тієї самої сторінки завжди обʼєднував два рівні, тож
 * SSR-розмітка й гідрація показували різні набори товарів.
 */
async function loadProductsByOption(
  db: ActorDb,
  optionId: string,
): Promise<ProductRow[]> {
  const onProduct = db
    .select({ marker: sql`1` })
    .from(productPropertyValues)
    .where(
      and(
        eq(productPropertyValues.productId, products.id),
        eq(productPropertyValues.optionId, optionId),
      ),
    );

  const onModification = db
    .select({ marker: sql`1` })
    .from(modificationPropertyValues)
    .innerJoin(
      productModifications,
      eq(modificationPropertyValues.modificationId, productModifications.id),
    )
    .where(
      and(
        eq(productModifications.productId, products.id),
        eq(modificationPropertyValues.optionId, optionId),
      ),
    );

  const rows = await db
    .select(productColumns)
    .from(products)
    // Предикат видимості — див. `./sections`.
    .where(
      and(
        eq(products.isActive, true),
        or(exists(onProduct), exists(onModification)),
      ),
    )
    .orderBy(desc(products.createdAt));

  return rows.map((row) => ({ ...row, images: toImageList(row.images) }));
}
