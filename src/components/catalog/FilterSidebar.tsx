import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

interface FilterSidebarProps {
  sectionId?: string;
  filters: Record<string, any>;
  onFilterChange: (filters: Record<string, any>) => void;
  priceRange?: { min: number; max: number };
  numericPropertyRanges?: Record<string, { min: number; max: number }>;
  products?: ProductForCounting[];
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

  // Update local price range when priceRange prop changes
  useEffect(() => {
    if (priceRange) {
      setLocalPriceRange([priceRange.min, priceRange.max]);
    }
  }, [priceRange]);

  // Fetch properties assigned to this section via section_property_assignments
  // Include both product and modification properties for filtering
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
      // Extract and filter properties - include both product and modification properties
      // Use a Map to deduplicate by property id
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
  
  // Get property IDs for select/multiselect properties
  const selectPropertyIds = filterableProperties
    .filter(p => p.property_type === "select" || p.property_type === "multiselect")
    .map(p => p.id);

  // Fetch property options from property_options table
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
      
      // Group by property_id
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

  // Local state for numeric property ranges
  const [localNumericRanges, setLocalNumericRanges] = useState<Record<string, [number, number]>>({});
  
  // Initialize local numeric ranges when props change
  useEffect(() => {
    const newRanges: Record<string, [number, number]> = {};
    Object.entries(numericPropertyRanges).forEach(([code, range]) => {
      newRanges[code] = [range.min, range.max];
    });
    setLocalNumericRanges(newRanges);
  }, [numericPropertyRanges]);

  const handleCheckboxChange = (propertySlug: string, optionId: string, checked: boolean) => {
    const current = filters[propertySlug] || [];
    const updated = checked
      ? [...current, optionId]
      : current.filter((v: string) => v !== optionId);
    
    onFilterChange({
      ...filters,
      [propertySlug]: updated.length > 0 ? updated : undefined,
    });
  };

  const handlePriceChange = (values: number[]) => {
    setLocalPriceRange([values[0], values[1]]);
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
    // Reset numeric ranges
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

  // Get options for a property
  const getOptionsForProperty = (property: Property): PropertyOption[] => {
    return propertyOptions?.[property.id] || [];
  };

  // Count products for each option
  const getOptionCount = (optionId: string): number => {
    return products.filter(product => 
      product.propertyValues.some(pv => {
        if (!pv.option_id) return false;
        // Handle comma-separated option_ids for multiselect
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
        <h3 className="font-semibold text-lg">Фільтри</h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="h-4 w-4 mr-1" />
            Скинути
          </Button>
        )}
      </div>

      {/* In Stock Only filter */}
      <div className="flex items-center gap-2 py-2 border-b">
        <Checkbox
          id="inStockOnly"
          checked={filters.inStockOnly === true}
          onCheckedChange={(checked) =>
            onFilterChange({
              ...filters,
              inStockOnly: checked ? true : undefined,
            })
          }
        />
        <Label htmlFor="inStockOnly" className="text-sm font-normal cursor-pointer">
          Тільки в наявності
        </Label>
      </div>

      <Accordion type="multiple" defaultValue={["price", ...filterableProperties.map(p => p.id)]} className="w-full">
        {/* Price filter */}
        {priceRange && (
          <AccordionItem value="price">
            <AccordionTrigger className="text-sm font-medium">
              Ціна
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <Slider
                  min={priceRange.min}
                  max={priceRange.max}
                  step={100}
                  value={localPriceRange}
                  onValueChange={handlePriceChange}
                  onValueCommit={handlePriceCommit}
                  className="w-full"
                />
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={localPriceRange[0]}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setLocalPriceRange([val, localPriceRange[1]]);
                    }}
                    onBlur={handlePriceCommit}
                    className="h-8 text-sm"
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="number"
                    value={localPriceRange[1]}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || priceRange.max;
                      setLocalPriceRange([localPriceRange[0], val]);
                    }}
                    onBlur={handlePriceCommit}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Property filters */}
        {filterableProperties.map((property) => {
          const options = getOptionsForProperty(property);
          
          return (
            <AccordionItem key={property.id} value={property.id}>
              <AccordionTrigger className="text-sm font-medium">
                {property.name}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2">
                  {property.property_type === "select" ||
                  property.property_type === "multiselect" ? (
                    options.length > 0 ? (
                      options.map((option) => {
                        const count = getOptionCount(option.id);
                        return (
                          <div key={option.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`${property.slug}-${option.id}`}
                            checked={(filters[property.slug] || []).includes(option.id)}
                            onCheckedChange={(checked) =>
                              handleCheckboxChange(property.slug, option.id, !!checked)
                            }
                            />
                          <Label
                            htmlFor={`${property.slug}-${option.id}`}
                              className="text-sm font-normal cursor-pointer flex-1"
                            >
                              {option.name}
                            </Label>
                            <span className="text-xs text-muted-foreground">
                              ({count})
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">Немає опцій</p>
                    )
                  ) : property.property_type === "boolean" ? (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`${property.slug}-true`}
                        checked={filters[property.slug] === true}
                        onCheckedChange={(checked) =>
                          onFilterChange({
                            ...filters,
                            [property.slug]: checked ? true : undefined,
                          })
                        }
                      />
                      <Label
                        htmlFor={`${property.slug}-true`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        Так
                      </Label>
                    </div>
                  ) : property.property_type === "color" ? (
                    options.map((option) => {
                      const count = getOptionCount(option.id);
                      return (
                        <div key={option.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`${property.slug}-${option.id}`}
                            checked={(filters[property.slug] || []).includes(option.id)}
                            onCheckedChange={(checked) =>
                              handleCheckboxChange(property.slug, option.id, !!checked)
                            }
                          />
                          <div
                            className="w-4 h-4 rounded-full border"
                            style={{ backgroundColor: option.name }}
                          />
                          <Label
                            htmlFor={`${property.slug}-${option.id}`}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {option.name}
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            ({count})
                          </span>
                        </div>
                      );
                    })
                  ) : (property.property_type === "number" || property.property_type === "range") && numericPropertyRanges[property.slug] ? (
                    <div className="space-y-4">
                      <Slider
                        min={numericPropertyRanges[property.slug].min}
                        max={numericPropertyRanges[property.slug].max}
                        step={1}
                        value={localNumericRanges[property.slug] || [numericPropertyRanges[property.slug].min, numericPropertyRanges[property.slug].max]}
                        onValueChange={(values) => handleNumericRangeChange(property.slug, values)}
                        onValueCommit={() => handleNumericRangeCommit(property.slug)}
                        className="w-full"
                      />
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={localNumericRanges[property.slug]?.[0] ?? numericPropertyRanges[property.slug].min}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || numericPropertyRanges[property.slug].min;
                            handleNumericRangeChange(property.slug, [val, localNumericRanges[property.slug]?.[1] ?? numericPropertyRanges[property.slug].max]);
                          }}
                          onBlur={() => handleNumericRangeCommit(property.slug)}
                          className="h-8 text-sm"
                        />
                        <span className="text-muted-foreground">—</span>
                        <Input
                          type="number"
                          value={localNumericRanges[property.slug]?.[1] ?? numericPropertyRanges[property.slug].max}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || numericPropertyRanges[property.slug].max;
                            handleNumericRangeChange(property.slug, [localNumericRanges[property.slug]?.[0] ?? numericPropertyRanges[property.slug].min, val]);
                          }}
                          onBlur={() => handleNumericRangeCommit(property.slug)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
