import { and, asc, eq, exists, inArray, min, sql, type SQL } from 'drizzle-orm';
import {
  modificationPropertyValues,
  productModifications,
  productPropertyValues,
  products,
  sectionProperties,
  sectionPropertyAssignments,
  sections,
} from 'simplycms/schema';
import type { ActorDb } from './db';

/** Характеристика в панелі фільтрів. */
export interface ScopedFilterProperty {
  id: string;
  slug: string;
  name: string;
  property_type: string;
  is_filterable: boolean;
}

/**
 * Фільтровні характеристики області каталогу — розділу або, при `null`,
 * кореня (усі товари).
 *
 * 🔴 Корінь = об'єднання призначень АКТИВНИХ розділів, але лише тих
 * характеристик, що реально мають значення в активному товарі (прямо або
 * через його модифікацію): інакше корінь обріс би порожніми фільтрами
 * розділів, у яких ще немає товарів. Дублі за `property_id` схлопує
 * `group by`; порядок — мінімальний `sort_order` призначення, далі назва й
 * `id`, тож однаковий між запитами.
 *
 * Стан до хвилі мультимовності: дизайн `2026-10-14-multilingual-wave-design.md`
 * §8 переводить каталог на сервер і замінює `/catalog` — тут мінімально
 * коректний корінь, нічого понад.
 *
 * 🔴 У розділі відбір лишився як був (усі його фільтровні призначення):
 * порожню характеристику власник розділу призначив свідомо.
 */
export async function selectScopedFilterProperties(
  db: ActorDb,
  sectionId: string | null,
  types?: readonly (typeof sectionProperties.propertyType.enumValues)[number][],
): Promise<ScopedFilterProperty[]> {
  const typeFilter: SQL[] = types?.length
    ? [inArray(sectionProperties.propertyType, [...types])]
    : [];
  const columns = {
    id: sectionProperties.id,
    name: sectionProperties.name,
    slug: sectionProperties.slug,
    property_type: sectionProperties.propertyType,
    is_filterable: sectionProperties.isFilterable,
  };

  if (sectionId !== null) {
    return db
      .select(columns)
      .from(sectionPropertyAssignments)
      .innerJoin(
        sectionProperties,
        eq(sectionPropertyAssignments.propertyId, sectionProperties.id),
      )
      .where(
        and(
          eq(sectionPropertyAssignments.sectionId, sectionId),
          eq(sectionProperties.isFilterable, true),
          ...typeFilter,
        ),
      )
      .orderBy(asc(sectionPropertyAssignments.sortOrder));
  }

  const onProduct = db
    .select({ one: sql`1` })
    .from(productPropertyValues)
    .innerJoin(products, eq(productPropertyValues.productId, products.id))
    .where(
      and(
        eq(productPropertyValues.propertyId, sectionProperties.id),
        eq(products.isActive, true),
      ),
    );
  const onModification = db
    .select({ one: sql`1` })
    .from(modificationPropertyValues)
    .innerJoin(
      productModifications,
      eq(modificationPropertyValues.modificationId, productModifications.id),
    )
    .innerJoin(products, eq(productModifications.productId, products.id))
    .where(
      and(
        eq(modificationPropertyValues.propertyId, sectionProperties.id),
        eq(products.isActive, true),
      ),
    );

  return db
    .select(columns)
    .from(sectionPropertyAssignments)
    .innerJoin(
      sections,
      and(
        eq(sectionPropertyAssignments.sectionId, sections.id),
        eq(sections.isActive, true),
      ),
    )
    .innerJoin(
      sectionProperties,
      eq(sectionPropertyAssignments.propertyId, sectionProperties.id),
    )
    .where(
      and(
        eq(sectionProperties.isFilterable, true),
        sql`(${exists(onProduct)} or ${exists(onModification)})`,
        ...typeFilter,
      ),
    )
    .groupBy(sectionProperties.id)
    .orderBy(
      asc(min(sectionPropertyAssignments.sortOrder)),
      asc(sectionProperties.name),
      asc(sectionProperties.id),
    );
}
