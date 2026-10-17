import { eq, inArray } from 'drizzle-orm';
import {
  modificationPropertyValues,
  productModifications,
  propertyOptions,
  sectionProperties,
} from 'simplycms/schema';
import type { ActorDb } from './db';
import { toNumericValue } from './entities/catalog-product';
import type { CatalogPropertyValueRow } from './entities/catalog-product';
import type { ProductPropertyValueViewModel } from 'simplycms/contracts/views';
import { toPropertyValueViewModel } from './property-values';
import { loadProductValueTexts } from './value-texts';

/** Плоскі значення характеристик модифікацій: `modificationId → значення`. */
export async function loadModificationValues(
  db: ActorDb,
  modificationIds: string[],
): Promise<Record<string, CatalogPropertyValueRow[]>> {
  const grouped: Record<string, CatalogPropertyValueRow[]> = {};
  if (modificationIds.length === 0) return grouped;

  const rows = await db
    .select({
      modification_id: modificationPropertyValues.modificationId,
      property_id: modificationPropertyValues.propertyId,
      value: modificationPropertyValues.value,
      bool_value: modificationPropertyValues.boolValue,
      numeric_value: modificationPropertyValues.numericValue,
      option_id: modificationPropertyValues.optionId,
    })
    .from(modificationPropertyValues)
    .where(inArray(modificationPropertyValues.modificationId, modificationIds));

  for (const row of rows) {
    (grouped[row.modification_id] ??= []).push({
      property_id: row.property_id,
      value: row.value,
      bool_value: row.bool_value,
      numeric_value: toNumericValue(row.numeric_value),
      option_id: row.option_id,
    });
  }
  return grouped;
}

/**
 * Значення характеристик модифікацій ОДНОГО товару разом з опцією й самою
 * характеристикою — форма, яку читає таблиця характеристик на картці.
 *
 * 🔴 Вхід — `productId`, а не список id модифікацій із браузера. Список,
 * присланий клієнтом, довелося б або довіряти, або звіряти зайвим запитом;
 * тут же вибірка за побудовою не виходить за межі одного товару.
 */
export async function loadProductModificationValues(
  db: ActorDb,
  productId: string,
  locale: string,
  primary: string,
): Promise<Record<string, ProductPropertyValueViewModel[]>> {
  const grouped: Record<string, ProductPropertyValueViewModel[]> = {};

  const rows = await db
    .select({
      modification_id: modificationPropertyValues.modificationId,
      value_id: modificationPropertyValues.id,
      property_id: modificationPropertyValues.propertyId,
      value: modificationPropertyValues.value,
      value_kind: modificationPropertyValues.valueKind,
      bool_value: modificationPropertyValues.boolValue,
      color_value: modificationPropertyValues.colorValue,
      numeric_value: modificationPropertyValues.numericValue,
      option_id: modificationPropertyValues.optionId,
      option: {
        id: propertyOptions.id,
        slug: propertyOptions.slug,
        name: propertyOptions.name,
      },
      property: {
        id: sectionProperties.id,
        name: sectionProperties.name,
        slug: sectionProperties.slug,
        property_type: sectionProperties.propertyType,
        has_page: sectionProperties.hasPage,
      },
    })
    .from(modificationPropertyValues)
    .innerJoin(
      productModifications,
      eq(modificationPropertyValues.modificationId, productModifications.id),
    )
    .leftJoin(
      propertyOptions,
      eq(modificationPropertyValues.optionId, propertyOptions.id),
    )
    .leftJoin(
      sectionProperties,
      eq(modificationPropertyValues.propertyId, sectionProperties.id),
    )
    .where(eq(productModifications.productId, productId));

  const texts = await loadProductValueTexts(
    db,
    'modification',
    rows.map((row) => row.value_id),
    locale,
    primary,
  );
  for (const row of rows) {
    (grouped[row.modification_id] ??= []).push(
      toPropertyValueViewModel(row, texts.get(row.value_id)),
    );
  }
  return grouped;
}

/**
 * Id модифікацій товару.
 *
 * 🔴 Потрібен ОКРЕМО від значень характеристик: модифікація без жодної
 * характеристики в мапі значень не зʼявляється, і залишки для неї тихо
 * не порахувались би — селектор показав би «немає в наявності» рівно там,
 * де адмінка нічого не заповнила.
 */
export async function loadModificationIds(
  db: ActorDb,
  productId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: productModifications.id })
    .from(productModifications)
    .where(eq(productModifications.productId, productId));

  return rows.map((row) => row.id);
}
