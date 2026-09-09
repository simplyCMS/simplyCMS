// Складання бейджів активних фільтрів (контракт тем v3, Фаза 4).
// Чиста функція «стан фільтрів → що показати над вибіркою».

import type { Translator } from 'simplycms/i18n';
import type {
  ActiveFilterChip,
  CatalogFiltersState,
  NumericProperty,
  NumericRange,
  NumericRanges,
} from './types';

/** Опція характеристики; назву групи читаємо з приєднаної гілки. */
export interface PropertyOptionRow {
  id: string;
  name: string;
  section_properties: unknown;
}

export interface ChipSources {
  priceRange: NumericRange | undefined;
  numericRanges: NumericRanges;
  numericProperties: NumericProperty[] | undefined;
  propertyOptions: PropertyOptionRow[] | undefined;
}

/** Бейдж діапазону: показує обрані межі, а пропущені — межами вибірки. */
function rangeChip(
  key: string,
  label: string,
  min: unknown,
  max: unknown,
  bounds: NumericRange | undefined,
  suffix = '',
): ActiveFilterChip {
  const from = min ?? bounds?.min ?? 0;
  const to = max ?? bounds?.max ?? '∞';
  return {
    key,
    label,
    value: `${from} - ${to}${suffix}`,
    type: key === 'price' ? 'price' : 'range',
  };
}

/**
 * Порядок бейджів — ціна, діапазони, опції; до спліту він повторював порядок
 * ключів у стані фільтрів. Різниця суто косметична (склад бейджів той самий),
 * зате зникає дедуплікація пар `…Min`/`…Max` пошуком по вже зібраному списку.
 */
export function buildActiveFilterChips(
  filters: CatalogFiltersState,
  t: Translator,
  sources: ChipSources,
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
    chips.push(
      rangeChip(
        'price',
        t('common.price'),
        filters.priceMin,
        filters.priceMax,
        sources.priceRange,
        ' ₴',
      ),
    );
  }

  sources.numericProperties?.forEach((prop) => {
    const min = filters[`${prop.slug}Min`];
    const max = filters[`${prop.slug}Max`];
    if (min === undefined && max === undefined) return;
    chips.push(
      rangeChip(
        prop.slug,
        prop.slug,
        min,
        max,
        sources.numericRanges[prop.slug],
      ),
    );
  });

  Object.entries(filters).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    value.forEach((optionId: string) => {
      const option = sources.propertyOptions?.find((o) => o.id === optionId);
      if (!option) return;
      const group = option.section_properties as { name: string } | null;
      chips.push({
        key,
        label: group?.name || key,
        value: option.name,
        type: 'option',
        optionId,
      });
    });
  });

  return chips;
}
