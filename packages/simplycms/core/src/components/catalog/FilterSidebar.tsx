
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../supabase/client";
import { X } from "lucide-react";

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

export function FilterSidebar({
  sectionId,
  filters,
  onFilterChange,
  priceRange,
  numericPropertyRanges = {},
  products = [],
}: FilterSidebarProps) {
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

  const { data: properties } = useQuery({
    queryKey: ["section-filter-properties", sectionId],
    queryFn: async () => {
      if (!sectionId) return [];
      const { data, error } = await supabase
        .from("section_property_assignments")
        .select(`
          applies_to,
          property:property_id (
            id,
            name,
            slug,
            property_type,
            is_filterable
          )
        `)
        .eq("section_id", sectionId);
      if (error) throw error;
      const propertyMap = new Map<string, Property>();
      data.forEach(a => {
        const prop = a.property as Property | null;
        if (prop && prop.is_filterable && !propertyMap.has(prop.id)) {
          propertyMap.set(prop.id, prop);
        }
      });
      return Array.from(propertyMap.values());
    },
    enabled: !!sectionId,
  });

  const filterableProperties = properties || [];

  const selectPropertyIds = filterableProperties
    .filter(p => p.property_type === "select" || p.property_type === "multiselect")
    .map(p => p.id);

  const { data: propertyOptions } = useQuery({
    queryKey: ["filter-property-options", selectPropertyIds],
    queryFn: async () => {
      if (selectPropertyIds.length === 0) return {};
      const { data, error } = await supabase
        .from("property_options")
        .select("*")
        .in("property_id", selectPropertyIds)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      const grouped: Record<string, PropertyOption[]> = {};
      data?.forEach(opt => {
        if (!grouped[opt.property_id]) {
          grouped[opt.property_id] = [];
        }
        grouped[opt.property_id].push(opt);
      });
      return grouped;
    },
    enabled: selectPropertyIds.length > 0,
  });

  const [localNumericRanges, setLocalNumericRanges] = useState<Record<string, [number, number]>>({});

  // Синхронізація числових діапазонів при зміні (adjust state during render)
  const [prevNumericRanges, setPrevNumericRanges] = useState(numericPropertyRanges);
  if (numericPropertyRanges !== prevNumericRanges) {
    setPrevNumericRanges(numericPropertyRanges);
    const newRanges: Record<string, [number, number]> = {};
    Object.entries(numericPropertyRanges).forEach(([code, range]) => {
      newRanges[code] = [range.min, range.max];
    });
    setLocalNumericRanges(newRanges);
  }

  const handleCheckboxChange = (propertySlug: string, optionId: string, checked: boolean) => {
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
    setLocalNumericRanges(prev => ({
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
    (key) => filters[key] !== undefined &&
    (Array.isArray(filters[key]) ? filters[key].length > 0 : true)
  );

  const getOptionsForProperty = (property: Property): PropertyOption[] => {
    return propertyOptions?.[property.id] || [];
  };

  const getOptionCount = (optionId: string): number => {
    return products.filter(product =>
      product.propertyValues.some(pv => {
        if (!pv.option_id) return false;
        const productOptionIds = pv.option_id.split(",").filter(Boolean);
        return productOptionIds.includes(optionId);
      })
    ).length;
  };

  if (!sectionId) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Фiльтри</h3>
        {hasActiveFilters && (
          <button
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            onClick={handleClearFilters}
          >
            <X className="h-4 w-4" />
            Скинути
          </button>
        )}
      </div>

      {/* In Stock Only filter */}
      <div className="flex items-center gap-2 py-2 border-b">
        <input
          type="checkbox"
          id="inStockOnly"
          checked={filters.inStockOnly === true}
          onChange={(e) =>
            onFilterChange({
              ...filters,
              inStockOnly: e.target.checked ? true : undefined,
            })
          }
          className="rounded"
        />
        <label htmlFor="inStockOnly" className="text-sm font-normal cursor-pointer">
          Тiльки в наявностi
        </label>
      </div>

      {/* Price filter */}
      {priceRange && (
        <div className="space-y-2 border-b pb-4">
          <h4 className="text-sm font-medium">Цiна</h4>
          <div className="flex items-center gap-2">
            <input
              type="number"
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
          property.property_type === "select" ||
          property.property_type === "multiselect" ||
          property.property_type === "color"
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
                      <input
                        type="checkbox"
                        id={`${property.slug}-${option.id}`}
                        checked={selectedIds.includes(option.id)}
                        onChange={(e) =>
                          handleCheckboxChange(property.slug, option.id, e.target.checked)
                        }
                        className="rounded"
                      />
                      {property.property_type === "color" && (
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
              })()) : (
                <p className="text-sm text-muted-foreground">Немає опцiй</p>
              )}
            </div>
          );
        }

        if (property.property_type === "boolean") {
          return (
            <div key={property.id} className="space-y-2 border-b pb-4">
              <h4 className="text-sm font-medium">{property.name}</h4>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`${property.slug}-true`}
                  checked={filters[property.slug] === true}
                  onChange={(e) =>
                    onFilterChange({
                      ...filters,
                      [property.slug]: e.target.checked ? true : undefined,
                    })
                  }
                  className="rounded"
                />
                <label
                  htmlFor={`${property.slug}-true`}
                  className="text-sm font-normal cursor-pointer"
                >
                  Так
                </label>
              </div>
            </div>
          );
        }

        if (
          (property.property_type === "number" || property.property_type === "range") &&
          numericPropertyRanges[property.slug]
        ) {
          const range = numericPropertyRanges[property.slug];
          return (
            <div key={property.id} className="space-y-2 border-b pb-4">
              <h4 className="text-sm font-medium">{property.name}</h4>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={localNumericRanges[property.slug]?.[0] ?? range.min}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || range.min;
                    handleNumericRangeChange(property.slug, [val, localNumericRanges[property.slug]?.[1] ?? range.max]);
                  }}
                  onBlur={() => handleNumericRangeCommit(property.slug)}
                  className="h-8 w-full text-sm border rounded px-2"
                />
                <span className="text-muted-foreground">&mdash;</span>
                <input
                  type="number"
                  value={localNumericRanges[property.slug]?.[1] ?? range.max}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || range.max;
                    handleNumericRangeChange(property.slug, [localNumericRanges[property.slug]?.[0] ?? range.min, val]);
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
