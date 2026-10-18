import { and, desc, eq, inArray, type SQL } from 'drizzle-orm';
import {
  catalogProductTexts as texts,
  languages,
  productModifications,
  productPrices,
  productPropertyValues,
  products,
  sections,
} from 'simplycms/schema';
import type { TextLocale } from 'simplycms/domain/translations';
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
import { productBaseColumns } from './entities/product';
import { toGallery } from './entities/gallery';
import {
  listLangs,
  listTextColumns,
  languageOf,
  textJoinOn,
} from './product-list-text';
import {
  groupPricesByProduct,
  priceColumns,
  visibleToViewer,
  type ViewerPriceTypes,
} from 'simplycms/commerce';
import { sectionRefColumns } from './entities/section';
import { loadModificationValues } from './modification-values';
import { pageVisible } from './product-visibility';

/**
 * Вибірка каталогу з усім, що потрібно фільтрам: модифікації, ціни,
 * характеристики обох рівнів і наявність.
 *
 * `sectionId` звужує вибірку сторінкою розділу; без нього беруться всі
 * активні товари — чипси каталогу перемикають розділ уже на клієнті.
 *
 * 🔴 Текст і адреса — з проєкції `catalog_product_texts` у мові `text` (П7); товар без
 * рядка проєкції в цій мові (немає адреси) у список не потрапляє: картка без `href`
 * була б мертвою. Опис розмітки в список не вибирається (Тема 9): він його не показує,
 * а санітизувати опис кожного товару сторінки було б марною роботою.
 *
 * 🔴 `is_active = true` — обовʼязковий предикат видимості: RLS на каталозі
 * немає (див. `./sections`), тож забутий фільтр не впаде, а тихо виведе
 * чернетки в магазин.
 *
 * 🔴 Запити послідовні й по `inArray`: транзакція живе на одному зʼєднанні,
 * тож `Promise.all` дав би лише уявний паралелізм (див. `./products`).
 *
 * 🔴 Ціни — лише видів `viewer` (Р29, `withViewerDb`).
 */
export async function loadCatalogProducts(
  db: ActorDb,
  viewer: ViewerPriceTypes,
  text: TextLocale,
  sectionId?: string,
): Promise<CatalogProductRow[]> {
  return loadCatalogProductsWhere(
    db,
    viewer,
    text,
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
  viewer: ViewerPriceTypes,
  text: TextLocale,
  extra?: SQL,
): Promise<CatalogProductRow[]> {
  const visible = extra ? and(pageVisible(), extra) : pageVisible();

  const rows = await db
    .select({
      product: productBaseColumns(text.locale, text.primary),
      text: listTextColumns,
      section: sectionRefColumns,
    })
    .from(products)
    .innerJoin(texts, textJoinOn(text))
    .innerJoin(languages, languageOf())
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
    .where(and(inArray(productPrices.productId, ids), visibleToViewer(viewer)));
  const valueRows = await db
    .select({
      product_id: productPropertyValues.productId,
      property_id: productPropertyValues.propertyId,
      bool_value: productPropertyValues.boolValue,
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
  const pricesByProduct = groupPricesByProduct(priceRows);

  const valuesByProduct: Record<string, CatalogPropertyValueRow[]> = {};
  for (const row of valueRows) {
    (valuesByProduct[row.product_id] ??= []).push({
      property_id: row.property_id,
      bool_value: row.bool_value,
      numeric_value: toNumericValue(row.numeric_value),
      option_id: row.option_id,
    });
  }

  return rows.map(({ product, text: row, section }) => {
    const mods = modsByProduct[product.id] ?? [];
    const defaultMod = pickDefaultModification(mods);

    const { fallback, ...rowText } = row;
    return {
      ...product,
      ...rowText,
      ...listLangs(fallback, text.primary),
      // Список каталогу розмітки опису не несе (картка читає лише картку товару).
      description: null,
      images: toGallery(product.images),
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
      isAvailable: calculateProductAvailability({
        id: product.id,
        has_modifications: product.has_modifications,
        stock_status: product.stock_status,
        product_modifications: mods,
        stock_by_pickup_point: [],
      }),
    };
  });
}
