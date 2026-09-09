import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import {
  productModifications,
  productPrices,
  productPropertyValues,
  products,
  sections,
} from 'simplycms/schema';
import { calculateProductAvailability } from 'simplycms/domain/inventory';
import type { ActorDb } from './db';
import {
  catalogModificationColumns,
  pickDefaultModification,
  toNumericValue,
  type CatalogModificationRow,
  type CatalogProductRow,
  type CatalogPropertyValueRow,
} from './entities/catalog-product';
import { productColumns, toImageList } from './entities/product';
import { groupPricesByProduct, priceColumns } from './entities/price';
import { sectionRefColumns } from './entities/section';
import { loadModificationValues } from './modification-values';
import { loadStockByModification, loadStockByProduct } from './stock';

/**
 * Вибірка каталогу з усім, що потрібно фільтрам: модифікації, ціни,
 * характеристики обох рівнів і наявність.
 *
 * `sectionId` звужує вибірку сторінкою розділу; без нього беруться всі
 * активні товари — чипси каталогу перемикають розділ уже на клієнті.
 *
 * 🔴 `is_active = true` — обовʼязковий предикат видимості: RLS на каталозі
 * немає (див. `./sections`), тож забутий фільтр не впаде, а тихо виведе
 * чернетки в магазин.
 *
 * 🔴 Запити послідовні й по `inArray`: транзакція живе на одному зʼєднанні,
 * тож `Promise.all` дав би лише уявний паралелізм (див. `./products`).
 */
export async function loadCatalogProducts(
  db: ActorDb,
  sectionId?: string,
): Promise<CatalogProductRow[]> {
  return loadCatalogProductsWhere(
    db,
    sectionId ? eq(products.sectionId, sectionId) : undefined,
  );
}

/**
 * Та сама вибірка, звужена ДОВІЛЬНИМ додатковим предикатом.
 *
 * 🔴 `is_active = true` доклеюється ТУТ і не є частиною аргументу: інакше
 * кожен новий викликач мусив би згадати про нього самостійно, і рано чи
 * пізно хтось би не згадав. Сторінка значення характеристики (`./property-option`)
 * — рівно такий викликач.
 */
export async function loadCatalogProductsWhere(
  db: ActorDb,
  extra?: SQL,
): Promise<CatalogProductRow[]> {
  const visible = extra
    ? and(eq(products.isActive, true), extra)
    : eq(products.isActive, true);

  const rows = await db
    .select({ product: productColumns, section: sectionRefColumns })
    .from(products)
    .leftJoin(sections, eq(products.sectionId, sections.id))
    .where(visible)
    .orderBy(desc(products.createdAt));

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.product.id);
  const modificationRows = await db
    .select(catalogModificationColumns)
    .from(productModifications)
    .where(inArray(productModifications.productId, ids));
  const priceRows = await db
    .select(priceColumns)
    .from(productPrices)
    .where(inArray(productPrices.productId, ids));
  const valueRows = await db
    .select({
      product_id: productPropertyValues.productId,
      property_id: productPropertyValues.propertyId,
      value: productPropertyValues.value,
      numeric_value: productPropertyValues.numericValue,
      option_id: productPropertyValues.optionId,
    })
    .from(productPropertyValues)
    .where(inArray(productPropertyValues.productId, ids));

  const modsByProduct: Record<string, CatalogModificationRow[]> = {};
  const modIds: string[] = [];
  for (const { product_id, ...mod } of modificationRows) {
    (modsByProduct[product_id] ??= []).push(mod);
    modIds.push(mod.id);
  }

  const valuesByModification = await loadModificationValues(db, modIds);
  const modificationStock = await loadStockByModification(db, modIds);
  const productStock = await loadStockByProduct(db, ids);
  const pricesByProduct = groupPricesByProduct(priceRows);

  const valuesByProduct: Record<string, CatalogPropertyValueRow[]> = {};
  for (const row of valueRows) {
    (valuesByProduct[row.product_id] ??= []).push({
      property_id: row.property_id,
      value: row.value,
      numeric_value: toNumericValue(row.numeric_value),
      option_id: row.option_id,
    });
  }

  return rows.map(({ product, section }) => {
    const mods = modsByProduct[product.id] ?? [];
    const defaultMod = pickDefaultModification(mods);

    return {
      ...product,
      images: toImageList(product.images),
      has_modifications: product.has_modifications ?? true,
      // `leftJoin` без збігу дає рядок із порожнім `id` (див. `./product-detail`).
      section: section?.id ? section : null,
      product_modifications: mods,
      modifications: defaultMod ? [defaultMod] : [],
      product_prices: pricesByProduct[product.id] ?? [],
      propertyValues: [
        ...(valuesByProduct[product.id] ?? []),
        ...mods.flatMap((mod) => valuesByModification[mod.id] ?? []),
      ],
      isAvailable: calculateProductAvailability(
        {
          id: product.id,
          has_modifications: product.has_modifications,
          stock_status: product.stock_status,
          product_modifications: mods,
          stock_by_pickup_point: [],
        },
        { modificationStock, productStock },
      ),
    };
  });
}
