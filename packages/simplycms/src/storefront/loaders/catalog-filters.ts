import { and, asc, eq, inArray, or } from 'drizzle-orm';
import {
  propertyOptions,
  sectionProperties,
  sectionPropertyAssignments,
} from 'simplycms/schema';
import type { ActorDb } from './db';

/** Числова характеристика розділу, придатна для фільтра-діапазону. */
export interface NumericPropertyRow {
  id: string;
  slug: string;
  property_type: string;
  is_filterable: boolean;
}

/** Опція характеристики для бейджа активного фільтра. */
export interface FilterOptionRow {
  id: string;
  name: string;
  property_id: string;
  /** Порядок з адмінки; у бейджах активних фільтрів не використовується. */
  slug?: string;
  sort_order?: number;
  section_properties: { name: string; slug: string } | null;
}

/**
 * Числові характеристики розділу, за якими можна фільтрувати.
 *
 * 🔴 Відбір `is_filterable` + тип робиться ЗАПИТОМ, а не після вибірки в
 * браузері: старий код тягнув усі призначення розділу й відсіював їх у JS,
 * тобто платив трафіком за рядки, які одразу викидав.
 */
export async function loadSectionNumericProperties(
  db: ActorDb,
  sectionId: string,
): Promise<NumericPropertyRow[]> {
  return db
    .select({
      id: sectionProperties.id,
      slug: sectionProperties.slug,
      property_type: sectionProperties.propertyType,
      is_filterable: sectionProperties.isFilterable,
    })
    .from(sectionPropertyAssignments)
    .innerJoin(
      sectionProperties,
      eq(sectionPropertyAssignments.propertyId, sectionProperties.id),
    )
    .where(
      and(
        eq(sectionPropertyAssignments.sectionId, sectionId),
        eq(sectionProperties.isFilterable, true),
        or(
          eq(sectionProperties.propertyType, 'number'),
          eq(sectionProperties.propertyType, 'range'),
        ),
      ),
    )
    .orderBy(asc(sectionPropertyAssignments.sortOrder));
}

/**
 * Усі опції характеристик — назви для бейджів активних фільтрів.
 *
 * Розділу вибірка не знає навмисно: бейджі показують назву опції, а вона від
 * розділу не залежить — інакше кожне перемикання чипса перезапитувало б
 * ті самі рядки.
 */
export async function loadFilterOptions(
  db: ActorDb,
): Promise<FilterOptionRow[]> {
  const rows = await db
    .select({
      id: propertyOptions.id,
      name: propertyOptions.name,
      property_id: propertyOptions.propertyId,
      property: { name: sectionProperties.name, slug: sectionProperties.slug },
    })
    .from(propertyOptions)
    .leftJoin(
      sectionProperties,
      eq(propertyOptions.propertyId, sectionProperties.id),
    )
    .orderBy(asc(propertyOptions.sortOrder));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    property_id: row.property_id,
    section_properties: row.property?.slug ? row.property : null,
  }));
}

/** Характеристика розділу в панелі фільтрів. */
export interface FilterPropertyRow extends NumericPropertyRow {
  name: string;
}

/** Панель фільтрів розділу: характеристики + опції тих, що з переліком. */
export interface SectionFilters {
  properties: FilterPropertyRow[];
  /** `propertyId → опції`; лише для `select`/`multiselect`. */
  optionsByProperty: Record<string, FilterOptionRow[]>;
}

/** Типи характеристик, які в панелі малюються переліком опцій. */
const OPTION_TYPES = ['select', 'multiselect'];

/**
 * Усе, що потрібно панелі фільтрів розділу, — ОДНИМ викликом.
 *
 * 🔴 Було два послідовні запити браузера, і другий чекав на перший, бо його
 * `in (…)` будувався з id, які повертав перший. Тут вони в одній транзакції,
 * а дедуплікація характеристик (одна може бути призначена і товару, і
 * модифікації) робиться там же, де й вибірка.
 */
export async function loadSectionFilters(
  db: ActorDb,
  sectionId: string,
): Promise<SectionFilters> {
  const rows = await db
    .select({
      id: sectionProperties.id,
      name: sectionProperties.name,
      slug: sectionProperties.slug,
      property_type: sectionProperties.propertyType,
      is_filterable: sectionProperties.isFilterable,
    })
    .from(sectionPropertyAssignments)
    .innerJoin(
      sectionProperties,
      eq(sectionPropertyAssignments.propertyId, sectionProperties.id),
    )
    .where(
      and(
        eq(sectionPropertyAssignments.sectionId, sectionId),
        eq(sectionProperties.isFilterable, true),
      ),
    )
    .orderBy(asc(sectionPropertyAssignments.sortOrder));

  const byId = new Map<string, FilterPropertyRow>();
  for (const row of rows) if (!byId.has(row.id)) byId.set(row.id, row);
  const properties = [...byId.values()];

  const optionIds = properties
    .filter((row) => OPTION_TYPES.includes(row.property_type))
    .map((row) => row.id);
  const optionsByProperty: Record<string, FilterOptionRow[]> = {};
  if (optionIds.length === 0) return { properties, optionsByProperty };

  const options = await db
    .select({
      id: propertyOptions.id,
      name: propertyOptions.name,
      property_id: propertyOptions.propertyId,
      slug: propertyOptions.slug,
      sort_order: propertyOptions.sortOrder,
    })
    .from(propertyOptions)
    .where(inArray(propertyOptions.propertyId, optionIds))
    .orderBy(asc(propertyOptions.sortOrder));

  for (const option of options) {
    (optionsByProperty[option.property_id] ??= []).push({
      ...option,
      section_properties: null,
    });
  }

  return { properties, optionsByProperty };
}
