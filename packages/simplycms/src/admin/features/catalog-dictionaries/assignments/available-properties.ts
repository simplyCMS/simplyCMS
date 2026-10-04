import type {
  SectionProperty,
  SectionPropertyAssignment,
} from 'simplycms/schema/types';

/**
 * Властивості, які ще можна призначити розділу (Review Focus 3).
 *
 * 🔴 Виключає БУДЬ-ЯКУ вже призначену цьому розділу властивість,
 * незалежно від `appliesTo`: унікальність у БД — `(section_id,
 * property_id)`, тож «та сама властивість і для модифікацій» дала б 409.
 * `assigned` — призначення ЛИШЕ цього розділу (обидва режими).
 */
export function availableProperties(
  all: readonly SectionProperty[],
  assigned: readonly SectionPropertyAssignment[],
): SectionProperty[] {
  const taken = new Set(assigned.map((a) => a.propertyId));
  return all.filter((p) => !taken.has(p.id));
}
