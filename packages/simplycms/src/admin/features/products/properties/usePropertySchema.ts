import { eq, inArray, useLiveQuery } from '@tanstack/react-db';
import {
  propertyOptionsCollection,
  sectionPropertiesCollection,
  sectionPropertyAssignmentsCollection,
  useCollection,
} from 'simplycms/admin-data';
import type {
  PropertyOption,
  SectionProperty,
  SectionPropertyAssignment,
} from 'simplycms/schema/types';

export type PropertyAppliesTo = 'product' | 'modification' | 'all';

export interface PropertySchemaRow {
  readonly assignment: SectionPropertyAssignment;
  readonly property: SectionProperty;
  readonly options: readonly PropertyOption[];
}

/**
 * Схема властивостей розділу (Task 10, Step 1) — ДВА-ТРИ запити, БЕЗ join
 * on-demand × on-demand (контракт Task 5): призначення розділу →
 * властивості (`inArray`) → опції обраних select/multiselect (`inArray`).
 *
 * 🔴 `inArray` з ПОРОЖНІМ масивом сервер відбиває (`impl/subset.ts`
 * superRefine, оператор `in` вимагає непорожній масив скалярів) — порожній
 * список наступного рівня вимикає запит: білдер повертає `undefined`
 * (той самий патерн, що `ProductEditPage` для невалідного id).
 */
export function usePropertySchema(
  sectionId: string | null,
  appliesTo: PropertyAppliesTo,
): {
  readonly rows: readonly PropertySchemaRow[];
  readonly isLoading: boolean;
} {
  const assignmentsCol = useCollection(sectionPropertyAssignmentsCollection);
  const propertiesCol = useCollection(sectionPropertiesCollection);
  const optionsCol = useCollection(propertyOptionsCollection);

  const { data: assignments, isLoading: loadingAssignments } = useLiveQuery(
    (q) => {
      if (!sectionId) return undefined;
      const base = q
        .from({ a: assignmentsCol })
        .where(({ a }) => eq(a.sectionId, sectionId));
      return (
        appliesTo === 'all'
          ? base
          : base.where(({ a }) => eq(a.appliesTo, appliesTo))
      ).orderBy(({ a }) => a.sortOrder, 'asc');
    },
    [sectionId, appliesTo],
  );
  const assignmentRows = assignments ?? [];
  const propertyIds = assignmentRows.map((a) => a.propertyId);

  const { data: properties, isLoading: loadingProperties } = useLiveQuery(
    (q) =>
      propertyIds.length === 0
        ? undefined
        : q
            .from({ p: propertiesCol })
            .where(({ p }) => inArray(p.id, propertyIds)),
    [propertyIds.join(',')],
  );
  const propsById = new Map((properties ?? []).map((p) => [p.id, p]));
  const choiceIds = (properties ?? [])
    .filter(
      (p) => p.propertyType === 'select' || p.propertyType === 'multiselect',
    )
    .map((p) => p.id);

  const { data: options, isLoading: loadingOptions } = useLiveQuery(
    (q) =>
      choiceIds.length === 0
        ? undefined
        : q
            .from({ o: optionsCol })
            .where(({ o }) => inArray(o.propertyId, choiceIds))
            .orderBy(({ o }) => o.sortOrder, 'asc'),
    [choiceIds.join(',')],
  );
  const optionsByProperty = new Map<string, PropertyOption[]>();
  for (const opt of options ?? []) {
    const list = optionsByProperty.get(opt.propertyId) ?? [];
    list.push(opt);
    optionsByProperty.set(opt.propertyId, list);
  }

  const rows: PropertySchemaRow[] = [];
  for (const assignment of assignmentRows) {
    const property = propsById.get(assignment.propertyId);
    // Властивість ще не довантажилась (проміжний рендер) — пропускаємо,
    // а не падаємо: наступний тік `properties` її додасть.
    if (!property) continue;
    rows.push({
      assignment,
      property,
      options: optionsByProperty.get(property.id) ?? [],
    });
  }

  return {
    rows,
    isLoading: loadingAssignments || loadingProperties || loadingOptions,
  };
}
