import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ENTITY, entityKey } from 'simplycms/contracts/entities';
import { getSectionFilters } from 'simplycms/core/lib/section-filters';
import { X } from 'lucide-react';
import { useT } from 'simplycms/i18n';
import { FilterCheckbox } from './FilterCheckbox';

/**
 * 🔴 Панель читає `section_property_assignments` + `section_properties` +
 * `property_options` одним викликом (`getSectionFilters`) — `sectionProperties`
 * лишається якорем ключа: саме її рядки формують видиму панель фільтрів.
 */
const sectionProperties = entityKey(ENTITY.sectionProperties);

interface Property {
  id: string;
  name: string;
  slug: string;
  property_type: string;
  is_filterable: boolean;
}

interface PropertyOption {
  id: string;
  property_id: string;
  name: string;
  slug: string;
  sort_order: number;
}

interface ProductForCounting {
  propertyValues: Array<{
    property_id: string;
    option_id?: string | null;
  }>;
}

/** Тип значення фільтра */
export type FilterValue = boolean | number | string[] | undefined;

interface FilterSidebarProps {
  sectionId?: string;
  filters: Record<string, FilterValue>;
  onFilterChange: (filters: Record<string, FilterValue>) => void;
  priceRange?: { min: number; max: number };
  numericPropertyRanges?: Record<string, { min: number; max: number }>;
  products?: ProductForCounting[];
  /** Render UI components - the host app should provide these */
  renderButton?: (props: Record<string, unknown>) => React.ReactNode;
  renderCheckbox?: (props: Record<string, unknown>) => React.ReactNode;
  renderLabel?: (props: Record<string, unknown>) => React.ReactNode;
  renderSlider?: (props: Record<string, unknown>) => React.ReactNode;
  renderInput?: (props: Record<string, unknown>) => React.ReactNode;
  renderAccordion?: (props: Record<string, unknown>) => React.ReactNode;
}

/**
 * Стабільні default-и пропсів: панель порівнює `numericPropertyRanges` за
 * посиланням (синхронізація стану під час рендеру), тож свіжий `{}`/`[]` на
 * кожен рендер зациклив би її, якщо тема опустить проп.
 */
const EMPTY_RANGES: Record<string, { min: number; max: number }> = {};
const EMPTY_PRODUCTS: ProductForCounting[] = [];

export function FilterSidebar({
  sectionId,
  filters,
  onFilterChange,
  priceRange,
  numericPropertyRanges = EMPTY_RANGES,
  products = EMPTY_PRODUCTS,
  renderCheckbox,
}: FilterSidebarProps) {
  const t = useT();
  const [localPriceRange, setLocalPriceRange] = useState<[number, number]>([
    priceRange?.min || 0,
    priceRange?.max || 100000,
  ]);

  // Синхронізація діапазону цін при зміні (adjust state during render)
  const [prevPriceRange, setPrevPriceRange] = useState(priceRange);
  if (priceRange && priceRange !== prevPriceRange) {
    setPrevPriceRange(priceRange);
    setLocalPriceRange([priceRange.min, priceRange.max]);
  }

  /**
   * 🔴 Один серверний виклик замість двох послідовних запитів браузера:
   * другий чекав на перший, бо будував `in (…)` з його ж результату. Тепер
   * характеристики й опції приходять однією транзакцією.
   */
  const { data } = useQuery({
    // Без розділу — окремий scope кореня каталогу, не порожній id розділу.
    queryKey: sectionId
      ? sectionProperties.scoped('section', sectionId)
      : sectionProperties.variant('section-filters-root'),
    queryFn: () => getSectionFilters({ data: sectionId ? { sectionId } : {} }),
  });

  const filterableProperties: Property[] = data?.properties ?? [];
  const propertyOptions: Record<string, PropertyOption[]> | undefined =
    data?.optionsByProperty as Record<string, PropertyOption[]> | undefined;

  const [localNumericRanges, setLocalNumericRanges] = useState<
    Record<string, [number, number]>
  >({});

  // Синхронізація числових діапазонів при зміні (adjust state during render)
  const [prevNumericRanges, setPrevNumericRanges] = useState(
    numericPropertyRanges,
  );
  if (numericPropertyRanges !== prevNumericRanges) {
    setPrevNumericRanges(numericPropertyRanges);
    const newRanges: Record<string, [number, number]> = {};
    Object.entries(numericPropertyRanges).forEach(([code, range]) => {
      newRanges[code] = [range.min, range.max];
    });
    setLocalNumericRanges(newRanges);
  }

  const handleCheckboxChange = (
    propertySlug: string,
    optionId: string,
    checked: boolean,
  ) => {
    const raw = filters[propertySlug];
    const current = Array.isArray(raw) ? raw : [];
    const updated = checked
      ? [...current, optionId]
      : current.filter((v: string) => v !== optionId);

    onFilterChange({
      ...filters,
      [propertySlug]: updated.length > 0 ? updated : undefined,
    });
  };

  const handlePriceCommit = () => {
    onFilterChange({
      ...filters,
      priceMin: localPriceRange[0],
      priceMax: localPriceRange[1],
    });
  };

  const handleNumericRangeChange = (propertySlug: string, values: number[]) => {
    setLocalNumericRanges((prev) => ({
      ...prev,
      [propertySlug]: [values[0], values[1]],
    }));
  };

  const handleNumericRangeCommit = (propertySlug: string) => {
    const range = localNumericRanges[propertySlug];
    if (range) {
      onFilterChange({
        ...filters,
        [`${propertySlug}Min`]: range[0],
        [`${propertySlug}Max`]: range[1],
      });
    }
  };

  const handleClearFilters = () => {
    setLocalPriceRange([priceRange?.min || 0, priceRange?.max || 100000]);
    const newRanges: Record<string, [number, number]> = {};
    Object.entries(numericPropertyRanges).forEach(([slug, range]) => {
      newRanges[slug] = [range.min, range.max];
    });
    setLocalNumericRanges(newRanges);
    onFilterChange({});
  };

  const hasActiveFilters = Object.keys(filters).some(
    (key) =>
      filters[key] !== undefined &&
      (Array.isArray(filters[key]) ? filters[key].length > 0 : true),
  );

  const getOptionsForProperty = (property: Property): PropertyOption[] => {
    return propertyOptions?.[property.id] || [];
  };

  const getOptionCount = (optionId: string): number => {
    return products.filter((product) =>
      product.propertyValues.some((pv) => {
        if (!pv.option_id) return false;
        const productOptionIds = pv.option_id.split(',').filter(Boolean);
        return productOptionIds.includes(optionId);
      }),
    ).length;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{t('catalog.filters')}</h3>
        {hasActiveFilters && (
          <button
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            onClick={handleClearFilters}
          >
            <X className="h-4 w-4" />
            {t('common.reset')}
          </button>
        )}
      </div>

      {/* In Stock Only filter */}
      <div className="flex items-center gap-2 py-2 border-b">
        <FilterCheckbox
          id="inStockOnly"
          checked={filters.inStockOnly === true}
          onCheckedChange={(checked) =>
            onFilterChange({
              ...filters,
              inStockOnly: checked ? true : undefined,
            })
          }
          renderCheckbox={renderCheckbox}
        />
        <label
          htmlFor="inStockOnly"
          className="text-sm font-normal cursor-pointer"
        >
          {t('catalog.filters.inStockOnly')}
        </label>
      </div>

      {/* Price filter */}
      {priceRange && (
        <div className="space-y-2 border-b pb-4">
          <h4 className="text-sm font-medium">{t('common.price')}</h4>
          <div className="flex items-center gap-2">
            <input
              type="number"
              aria-label={t('catalog.filters.priceMinAria')}
              value={localPriceRange[0]}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setLocalPriceRange([val, localPriceRange[1]]);
              }}
              onBlur={handlePriceCommit}
              className="h-8 w-full text-sm border rounded px-2"
            />
            <span className="text-muted-foreground">&mdash;</span>
            <input
              type="number"
              aria-label={t('catalog.filters.priceMaxAria')}
              value={localPriceRange[1]}
              onChange={(e) => {
                const val = parseInt(e.target.value) || priceRange.max;
                setLocalPriceRange([localPriceRange[0], val]);
              }}
              onBlur={handlePriceCommit}
              className="h-8 w-full text-sm border rounded px-2"
            />
          </div>
        </div>
      )}

      {/* Property filters */}
      {filterableProperties.map((property) => {
        const options = getOptionsForProperty(property);

        if (
          property.property_type === 'select' ||
          property.property_type === 'multiselect' ||
          property.property_type === 'color'
        ) {
          return (
            <div key={property.id} className="space-y-2 border-b pb-4">
              <h4 className="text-sm font-medium">{property.name}</h4>
              {options.length > 0 ? (
                (() => {
                  const filterVal = filters[property.slug];
                  const selectedIds = Array.isArray(filterVal) ? filterVal : [];
                  return options.map((option) => {
                    const count = getOptionCount(option.id);
                    return (
                      <div key={option.id} className="flex items-center gap-2">
                        <FilterCheckbox
                          id={`${property.slug}-${option.id}`}
                          checked={selectedIds.includes(option.id)}
                          onCheckedChange={(checked) =>
                            handleCheckboxChange(
                              property.slug,
                              option.id,
                              checked,
                            )
                          }
                          renderCheckbox={renderCheckbox}
                        />
                        {property.property_type === 'color' && (
                          <div
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: option.name }}
                          />
                        )}
                        <label
                          htmlFor={`${property.slug}-${option.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {option.name}
                        </label>
                        <span className="text-xs text-muted-foreground">
                          ({count})
                        </span>
                      </div>
                    );
                  });
                })()
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t('catalog.filters.noOptions')}
                </p>
              )}
            </div>
          );
        }

        if (property.property_type === 'boolean') {
          return (
            <div key={property.id} className="space-y-2 border-b pb-4">
              <h4 className="text-sm font-medium">{property.name}</h4>
              <div className="flex items-center gap-2">
                <FilterCheckbox
                  id={`${property.slug}-true`}
                  checked={filters[property.slug] === true}
                  onCheckedChange={(checked) =>
                    onFilterChange({
                      ...filters,
                      [property.slug]: checked ? true : undefined,
                    })
                  }
                  renderCheckbox={renderCheckbox}
                />
                <label
                  htmlFor={`${property.slug}-true`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {t('common.yes')}
                </label>
              </div>
            </div>
          );
        }

        if (
          (property.property_type === 'number' ||
            property.property_type === 'range') &&
          numericPropertyRanges[property.slug]
        ) {
          const range = numericPropertyRanges[property.slug];
          return (
            <div key={property.id} className="space-y-2 border-b pb-4">
              <h4 className="text-sm font-medium">{property.name}</h4>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  aria-label={t('catalog.filters.propertyMinAria', {
                    property: property.name,
                  })}
                  value={localNumericRanges[property.slug]?.[0] ?? range.min}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || range.min;
                    handleNumericRangeChange(property.slug, [
                      val,
                      localNumericRanges[property.slug]?.[1] ?? range.max,
                    ]);
                  }}
                  onBlur={() => handleNumericRangeCommit(property.slug)}
                  className="h-8 w-full text-sm border rounded px-2"
                />
                <span className="text-muted-foreground">&mdash;</span>
                <input
                  type="number"
                  aria-label={t('catalog.filters.propertyMaxAria', {
                    property: property.name,
                  })}
                  value={localNumericRanges[property.slug]?.[1] ?? range.max}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || range.max;
                    handleNumericRangeChange(property.slug, [
                      localNumericRanges[property.slug]?.[0] ?? range.min,
                      val,
                    ]);
                  }}
                  onBlur={() => handleNumericRangeCommit(property.slug)}
                  className="h-8 w-full text-sm border rounded px-2"
                />
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
