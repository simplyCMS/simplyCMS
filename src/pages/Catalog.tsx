import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ProductCard } from "@/components/catalog/ProductCard";
import { FilterSidebar } from "@/components/catalog/FilterSidebar";
import { ActiveFilters } from "@/components/catalog/ActiveFilters";
import { Loader2, ChevronRight, Filter, LayoutGrid, List, FolderOpen } from "lucide-react";
import { fetchModificationStockData, fetchModificationPropertyValues, enrichProductsWithAvailability } from "@/hooks/useProductsWithStock";
import { usePriceType } from "@/hooks/usePriceType";
import { resolvePrice } from "@/lib/priceUtils";
import { useDiscountGroups, useDiscountContext, applyDiscount } from "@/hooks/useDiscountedPrice";
import { useProductRatings } from "@/hooks/useProductReviews";

type SortOption = "popular" | "price_asc" | "price_desc" | "newest";

export default function Catalog() {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [sortBy, setSortBy] = useState<SortOption>("popular");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);

  const { priceTypeId, defaultPriceTypeId } = usePriceType();
  const { data: discountGroups = [] } = useDiscountGroups();
  const discountCtx = useDiscountContext();


  // Fetch all sections
  const { data: sections } = useQuery({
    queryKey: ["public-sections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all products with modifications, prices, property values, and stock
  const { data: rawProducts, isLoading: productsLoading } = useQuery({
    queryKey: ["all-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          sections(id, slug, name),
          product_modifications(id, stock_status, is_default, sort_order),
          product_prices(price_type_id, price, old_price, modification_id),
          product_property_values(property_id, value, numeric_value, option_id),
          stock_by_pickup_point(quantity)
        `)
        .eq("is_active", true);
      if (error) throw error;

      const modificationIds = data.flatMap(p =>
        (p.product_modifications || []).map((m: any) => m.id)
      );

      const [modPropertyValues, modStockData] = await Promise.all([
        fetchModificationPropertyValues(modificationIds),
        fetchModificationStockData(modificationIds),
      ]);

      const mapped = data.map((product) => {
        const mods = product.product_modifications || [];
        const defaultMod =
          mods.find((m: any) => m.is_default) ||
          mods.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
        const images = product.images as string[] | null;
        const hasModifications = (product as any).has_modifications ?? true;

        const allPropertyValues = [
          ...(product.product_property_values || []),
          ...mods.flatMap((m: any) => modPropertyValues[m.id] || [])
        ];

        return {
          ...product,
          images: Array.isArray(images) ? images : [],
          section: product.sections,
          has_modifications: hasModifications,
          modifications: defaultMod ? [defaultMod] : [],
          propertyValues: allPropertyValues,
          product_prices: product.product_prices || [],
        };
      });

      return enrichProductsWithAvailability(mapped, modStockData);
    },
  });

  // Resolve prices based on user's price type
  const products = useMemo(() => {
    if (!rawProducts) return undefined;
    const cartTotal = 0; // catalog view doesn't have cart context
    return rawProducts.map((p) => {
      const prices = (p as any).product_prices || [];
      let resolved;
      const modId = p.has_modifications && p.modifications?.[0] ? p.modifications[0].id : null;
      resolved = resolvePrice(prices, priceTypeId, defaultPriceTypeId, modId);
      
      const stockStatus = p.has_modifications
        ? (p.modifications?.[0]?.stock_status ?? "in_stock")
        : ((p as any).stock_status ?? "in_stock");

      let finalPrice = resolved.price;
      let oldPrice = resolved.oldPrice;

      // Apply discounts
      if (finalPrice !== null && discountGroups.length > 0) {
        const result = applyDiscount(finalPrice, discountGroups, {
          ...discountCtx,
          quantity: 1,
          cartTotal,
          productId: p.id,
          modificationId: modId,
          sectionId: p.section?.id || null,
        });
        if (result.totalDiscount > 0) {
          oldPrice = finalPrice; // original price becomes "old"
          finalPrice = result.finalPrice;
        }
      }

      return { ...p, price: finalPrice, old_price: oldPrice, stock_status: stockStatus };
    });
  }, [rawProducts, priceTypeId, defaultPriceTypeId, discountGroups, discountCtx]);

  // Product ratings
  const ratingProductIds = useMemo(() => products?.map((p: any) => p.id) || [], [products]);
  const { data: ratingsData } = useProductRatings(ratingProductIds);

  // Calculate price range
  const priceRange = useMemo(() => {
    if (!products?.length) return undefined;
    const prices = products
      .map((p) => p.price)
      .filter((p): p is number => typeof p === "number");
    if (prices.length === 0) return undefined;
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [products]);

  // Fetch numeric properties for selected section
  const { data: numericProperties } = useQuery({
    queryKey: ["section-numeric-properties", selectedSectionId],
    queryFn: async () => {
      if (!selectedSectionId) return [];
      const { data, error } = await supabase
        .from("section_property_assignments")
        .select(`
          property:property_id (
            id,
            slug,
            property_type,
            is_filterable
          )
        `)
        .eq("section_id", selectedSectionId);
      if (error) throw error;
      return data
        .map(a => a.property as { id: string; slug: string; property_type: string; is_filterable: boolean } | null)
        .filter((p): p is { id: string; slug: string; property_type: string; is_filterable: boolean } => 
          Boolean(p && p.is_filterable && (p.property_type === "number" || p.property_type === "range"))
        );
    },
    enabled: !!selectedSectionId,
  });

  // Calculate numeric property ranges from filtered products data
  const numericPropertyRanges = useMemo(() => {
    if (!products?.length || !numericProperties?.length) return {};
    
    // Only calculate ranges for products in the selected section
    const relevantProducts = selectedSectionId 
      ? products.filter(p => p.section?.id === selectedSectionId)
      : products;
    
    const ranges: Record<string, { min: number; max: number }> = {};
    
    numericProperties.forEach(prop => {
      const values: number[] = [];
      relevantProducts.forEach(product => {
        product.propertyValues.forEach((pv: any) => {
          if (pv.property_id === prop.id && pv.numeric_value !== null) {
            values.push(pv.numeric_value);
          }
        });
      });
      
      if (values.length > 0) {
        ranges[prop.slug] = {
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    });
    
    return ranges;
  }, [products, numericProperties, selectedSectionId]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    if (!products) return [];

    let result = [...products];

    // Filter by selected section
    if (selectedSectionId) {
      result = result.filter((p) => p.section?.id === selectedSectionId);
    }

    // Apply "In Stock Only" filter
    if (filters.inStockOnly) {
      result = result.filter((product) => product.isAvailable);
    }

    // Apply property filters (by option_id)
    Object.entries(filters).forEach(([key, value]) => {
      if (key === "priceMin" || key === "priceMax" || key === "inStockOnly") return;
      // Skip numeric range filters (they end with Min or Max)
      if (key.endsWith("Min") || key.endsWith("Max")) return;
      if (!value || (Array.isArray(value) && value.length === 0)) return;

      result = result.filter((product) => {
        const propValue = product.propertyValues.find(
          (pv: any) => {
            // Find by option_id in the selected values
            if (pv.option_id && Array.isArray(value)) {
              // Handle comma-separated option_ids for multiselect
              const productOptionIds = pv.option_id.split(",").filter(Boolean);
              return productOptionIds.some((id: string) => value.includes(id));
            }
            return false;
          }
        );
        return !!propValue;
      });
    });

    // Apply numeric property filters
    numericProperties?.forEach(prop => {
      const minKey = `${prop.slug}Min`;
      const maxKey = `${prop.slug}Max`;
      const minVal = filters[minKey];
      const maxVal = filters[maxKey];
      
      if (minVal !== undefined || maxVal !== undefined) {
        result = result.filter((product) => {
          // Find ALL matching property values (from any modification)
          const matchingValues = product.propertyValues.filter(
            (pv: any) => pv.property_id === prop.id && pv.numeric_value !== null
          );
          if (matchingValues.length === 0) return false; // Filter out products without this property value
          
          // Check if ANY of the values fall within the range (for products with multiple modifications)
          return matchingValues.some((pv: any) => {
            const val = pv.numeric_value;
            if (minVal !== undefined && val < minVal) return false;
            if (maxVal !== undefined && val > maxVal) return false;
            return true;
          });
        });
      }
    });

    // Apply price filter
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      result = result.filter((product) => {
        const price = product.price;
        if (price === undefined || price === null) return true;
        if (filters.priceMin !== undefined && price < filters.priceMin) return false;
        if (filters.priceMax !== undefined && price > filters.priceMax) return false;
        return true;
      });
    }

    // Sort
    switch (sortBy) {
      case "price_asc":
        result.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case "price_desc":
        result.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "newest":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      default:
        break;
    }

    return result;
  }, [products, filters, sortBy, selectedSectionId, numericProperties]);

  const handleSectionClick = (sectionId: string | null) => {
    setSelectedSectionId(sectionId);
    setFilters({});
  };

  // Fetch property options for active filters display
  const { data: allPropertyOptions } = useQuery({
    queryKey: ["all-property-options-for-filters", selectedSectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_options")
        .select("id, name, property_id, section_properties(name, slug)");
      if (error) throw error;
      return data;
    },
  });

  // Build active filters list for display
  const activeFiltersList = useMemo(() => {
    const result: Array<{
      key: string;
      label: string;
      value: string;
      type: "option" | "range" | "price";
      optionId?: string;
    }> = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined) return;

      // Price filters
      if (key === "priceMin" || key === "priceMax") {
        const existingPrice = result.find(f => f.type === "price");
        if (!existingPrice) {
          const min = filters.priceMin;
          const max = filters.priceMax;
          if (min !== undefined || max !== undefined) {
            result.push({
              key: "price",
              label: "Ціна",
              value: `${min ?? priceRange?.min ?? 0} - ${max ?? priceRange?.max ?? "∞"} ₴`,
              type: "price",
            });
          }
        }
        return;
      }

      // Numeric range filters
      if (key.endsWith("Min") || key.endsWith("Max")) {
        const propSlug = key.replace(/Min$|Max$/, "");
        const existingRange = result.find(f => f.key === propSlug && f.type === "range");
        if (!existingRange) {
          const min = filters[`${propSlug}Min`];
          const max = filters[`${propSlug}Max`];
          if (min !== undefined || max !== undefined) {
            const prop = numericProperties?.find(p => p.slug === propSlug);
            const propName = prop?.slug || propSlug;
            result.push({
              key: propSlug,
              label: propName,
              value: `${min ?? numericPropertyRanges[propSlug]?.min ?? 0} - ${max ?? numericPropertyRanges[propSlug]?.max ?? "∞"}`,
              type: "range",
            });
          }
        }
        return;
      }

      // Option filters (arrays)
      if (Array.isArray(value)) {
        value.forEach((optionId: string) => {
          const option = allPropertyOptions?.find(o => o.id === optionId);
          if (option) {
            result.push({
              key,
              label: (option.section_properties as any)?.name || key,
              value: option.name,
              type: "option",
              optionId,
            });
          }
        });
      }
    });

    return result;
  }, [filters, allPropertyOptions, priceRange, numericPropertyRanges, numericProperties]);

  const handleRemoveFilter = useCallback((filter: { key: string; type: string; optionId?: string }) => {
    const newFilters = { ...filters };
    
    if (filter.type === "price") {
      delete newFilters.priceMin;
      delete newFilters.priceMax;
    } else if (filter.type === "range") {
      delete newFilters[`${filter.key}Min`];
      delete newFilters[`${filter.key}Max`];
    } else if (filter.type === "option" && filter.optionId) {
      const current = newFilters[filter.key] as string[] || [];
      const updated = current.filter(id => id !== filter.optionId);
      if (updated.length > 0) {
        newFilters[filter.key] = updated;
      } else {
        delete newFilters[filter.key];
      }
    }
    
    setFilters(newFilters);
  }, [filters]);

  const handleClearAllFilters = useCallback(() => {
    setFilters({});
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors">
          Головна
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Каталог</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-4xl font-bold mb-2">Каталог</h1>
        <p className="text-muted-foreground">
          Оберіть категорію або скористайтесь фільтрами
        </p>
      </div>

      {/* Section chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Badge
          variant={selectedSectionId === null ? "default" : "outline"}
          className="cursor-pointer px-3 py-1.5 text-sm"
          onClick={() => handleSectionClick(null)}
        >
          Всі товари
        </Badge>
        {sections?.map((section) => (
          <Badge
            key={section.id}
            variant={selectedSectionId === section.id ? "default" : "outline"}
            className="cursor-pointer px-3 py-1.5 text-sm gap-2"
            onClick={() => handleSectionClick(section.id)}
          >
            {section.image_url ? (
              <img
                src={section.image_url}
                alt=""
                className="w-4 h-4 rounded object-cover"
              />
            ) : (
              <FolderOpen className="w-3 h-3" />
            )}
            {section.name}
          </Badge>
        ))}
      </div>

      <div className="flex gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <FilterSidebar
            sectionId={selectedSectionId || undefined}
            filters={filters}
            onFilterChange={setFilters}
            priceRange={priceRange}
            numericPropertyRanges={numericPropertyRanges}
            products={selectedSectionId ? products?.filter(p => p.section?.id === selectedSectionId) : products}
          />
        </aside>

        {/* Main content */}
        <div className="flex-1">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b">
            <div className="flex items-center gap-4">
              {/* Mobile filter button */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <Filter className="h-4 w-4 mr-2" />
                    Фільтри
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto">
                  <FilterSidebar
                    sectionId={selectedSectionId || undefined}
                    filters={filters}
                    onFilterChange={setFilters}
                    priceRange={priceRange}
                    numericPropertyRanges={numericPropertyRanges}
                    products={selectedSectionId ? products?.filter(p => p.section?.id === selectedSectionId) : products}
                  />
                </SheetContent>
              </Sheet>

              <span className="text-sm text-muted-foreground">
                {filteredProducts.length} товарів
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as SortOption)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">За популярністю</SelectItem>
                  <SelectItem value="newest">Новинки</SelectItem>
                  <SelectItem value="price_asc">Дешевші</SelectItem>
                  <SelectItem value="price_desc">Дорожчі</SelectItem>
                </SelectContent>
              </Select>

              <div className="hidden sm:flex border rounded-md">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="rounded-r-none"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="rounded-l-none"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Active filters badges */}
          <ActiveFilters
            filters={activeFiltersList}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
          />

          {/* Products grid */}
          {productsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length > 0 ? (
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "flex flex-col gap-4"
              }
            >
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} rating={ratingsData?.[product.id]} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                Товарів за вибраними фільтрами не знайдено
              </p>
              <Button variant="outline" onClick={() => setFilters({})}>
                Скинути фільтри
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
