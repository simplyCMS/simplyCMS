// Е3-13: multiselect у БД тепер рядок на опцію — картка вітрини зводить
// рядки однієї властивості в ОДИН запис view-моделі (контракт тем v3, один
// елемент на властивість, не міняється).

import type { ProductPropertyValueViewModel } from 'simplycms/contracts/views';

/** Групує рядки за property_id, зберігаючи порядок першої появи. */
function byProperty(
  rows: readonly ProductPropertyValueViewModel[],
): Map<string, ProductPropertyValueViewModel[]> {
  const map = new Map<string, ProductPropertyValueViewModel[]>();
  for (const r of rows)
    map.set(r.property_id, [...(map.get(r.property_id) ?? []), r]);
  return map;
}

/**
 * Характеристики картки: рядок на опцію (Е3-13) зводиться в ОДИН запис
 * view-моделі на властивість. Модифікація перекриває властивість товару
 * цілком — те саме правило, що в легасі (`Map.set` по property_id).
 */
export function mergePropertyValues(
  productRows: readonly ProductPropertyValueViewModel[],
  modRows: readonly ProductPropertyValueViewModel[],
): ProductPropertyValueViewModel[] {
  const merged = new Map(byProperty(productRows));
  for (const [id, rows] of byProperty(modRows)) merged.set(id, rows);

  return [...merged.values()].map((rows) =>
    rows.length === 1
      ? rows[0]!
      : {
          ...rows[0]!,
          value: rows
            .map((r) => r.value)
            .filter((v): v is string => Boolean(v))
            .join(', '),
          // 🔴 Кілька опцій — жодна не «головна»: ProductCharacteristics
          // малює <Link> на сторінку ОДНІЄЇ опції, коли has_page && option —
          // текст «Чорний, Білий» вів би лише на «Чорний».
          option: null,
          option_id: null,
        },
  );
}
