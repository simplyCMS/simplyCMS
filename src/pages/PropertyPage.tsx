import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePriceType } from "@/hooks/usePriceType";
import { resolvePrice } from "@/lib/priceUtils";

export default function PropertyPage() {
  const { propertySlug, optionSlug } = useParams<{
    propertySlug: string;
    optionSlug: string;
  }>();

  const { priceTypeId, defaultPriceTypeId } = usePriceType();
  const propertyCode = propertySlug;

  // Fetch property by slug
  const { data: property } = useQuery({
    queryKey: ["property-by-slug", propertyCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("section_properties")
        .select("*")
        .eq("slug", propertyCode!)
        .eq("has_page", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!propertyCode,
  });

  // Fetch option by slug (now includes page data)
  const { data: option, isLoading: optionLoading } = useQuery({
    queryKey: ["property-option-by-slug", property?.id, optionSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_options")
        .select("*")
        .eq("property_id", property!.id)
        .eq("slug", optionSlug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!property?.id && !!optionSlug,
  });

  // Fetch products with this property value
  const { data: rawProducts, isLoading: productsLoading } = useQuery({
    queryKey: ["products-by-option", option?.id],
    queryFn: async () => {
      if (!option?.id) return [];

      // Get product IDs that have this option at product level
      const { data: productLevelValues, error: pvError } = await supabase
        .from("product_property_values")
        .select("product_id")
        .eq("option_id", option.id);
      
      if (pvError) throw pvError;
      
      // Get modification IDs that have this option at modification level
      const { data: modLevelValues, error: mvError } = await supabase
        .from("modification_property_values")
        .select("modification_id, product_modifications!inner(product_id)")
        .eq("option_id", option.id);
      
      if (mvError) throw mvError;
      
      // Combine unique product IDs
      const productIds = new Set<string>();
      productLevelValues?.forEach(pv => productIds.add(pv.product_id));
      modLevelValues?.forEach(mv => {
        const productId = (mv.product_modifications as any)?.product_id;
        if (productId) productIds.add(productId);
      });
      
      if (productIds.size === 0) return [];

      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          sections(id, slug, name),
          product_modifications(stock_status, is_default, sort_order),
          product_prices(price_type_id, price, old_price, modification_id)
        `)
        .in("id", Array.from(productIds))
        .eq("is_active", true);

      if (error) throw error;

      return data.map((product) => {
        const mods = product.product_modifications || [];
        const defaultMod =
          mods.find((m: any) => m.is_default) ||
          mods.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
        const images = product.images as string[] | null;
        return {
          ...product,
          images: Array.isArray(images) ? images : [],
          section: product.sections,
          modifications: defaultMod ? [defaultMod] : [],
          product_prices: product.product_prices || [],
        };
      });
    },
    enabled: !!option?.id,
  });

  // Resolve prices
  const products = useMemo(() => {
    if (!rawProducts) return undefined;
    return rawProducts.map((p) => {
      const prices = (p as any).product_prices || [];
      const hasModifications = (p as any).has_modifications ?? true;
      let resolved;
      if (hasModifications && p.modifications?.[0]) {
        resolved = resolvePrice(prices, priceTypeId, defaultPriceTypeId, (p.modifications[0] as any).id);
      } else {
        resolved = resolvePrice(prices, priceTypeId, defaultPriceTypeId, null);
      }
      const stockStatus = hasModifications
        ? (p.modifications?.[0]?.stock_status ?? "in_stock")
        : ((p as any).stock_status ?? "in_stock");
      return { ...p, price: resolved.price, old_price: resolved.oldPrice, stock_status: stockStatus };
    });
  }, [rawProducts, priceTypeId, defaultPriceTypeId]);

  if (optionLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!option) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Сторінку не знайдено</h1>
        <Link to="/catalog">
          <Button>Повернутись до каталогу</Button>
        </Link>
      </div>
    );
  }

  // Page data is now directly on the option
  const displayName = option.name;
  const description = option.description;
  const imageUrl = option.image_url;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/" className="hover:text-foreground transition-colors">
          Головна
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link to="/properties" className="hover:text-foreground transition-colors">
          Властивості
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link to={`/properties/${property?.slug}`} className="hover:text-foreground transition-colors">
          {property?.name}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{displayName}</span>
      </nav>

      {/* Hero section */}
      <div className="mb-8">
        {imageUrl && (
          <div className="w-full h-48 md:h-64 mb-6 rounded-xl overflow-hidden">
            <img
              src={imageUrl}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <h1 className="text-4xl font-bold mb-4">{displayName}</h1>
        
        {description && (
          <div
            className="prose prose-lg max-w-none text-muted-foreground dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: description }}
          />
        )}
      </div>

      {/* Products section */}
      <div>
        <h2 className="text-2xl font-bold mb-6">
          Товари {property?.name ? `(${property.name}: ${option.name})` : ""}
        </h2>

        {productsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">
              Товарів з цією характеристикою поки немає
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
