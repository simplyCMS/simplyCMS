import { useState, useMemo, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearch, useLocation, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSupabaseClient } from "../supabase/SupabaseProvider";
import { Button } from "@simplysoftua/ui/button";
import { Badge } from "@simplysoftua/ui/badge";
import { Separator } from "@simplysoftua/ui/separator";

import { ProductGallery } from "../components/catalog/ProductGallery";
import { ModificationSelector, type ModificationStockInfo } from "../components/catalog/ModificationSelector";
import { ProductCharacteristics } from "../components/catalog/ProductCharacteristics";
import { useCart } from "../hooks/useCart";
import { useToast } from "../hooks/use-toast";
import {
  Loader2,
  ChevronRight,
  ShoppingCart,
  Heart,
  Share2,
} from "lucide-react";
import { StockDisplay } from "../components/catalog/StockDisplay";
import { PluginSlot } from "@simplysoftua/plugins/PluginSlot";
import { ProductReviews } from "../components/reviews/ProductReviews";
import { usePriceType } from "../hooks/usePriceType";
import { resolvePrice, type PriceEntry } from "../lib/priceUtils";
import { useDiscountGroups, useDiscountContext, applyDiscount } from "../hooks/useDiscountedPrice";
import type { Tables } from "../supabase/types";

/** Елемент характеристики товару з інформацією про властивість та опцію */
interface PropertyValueItem {
  property_id: string;
  value: string | null;
  numeric_value: number | null;
  option_id: string | null;
  option: { id: string; slug: string } | null;
  property: { id: string; name: string; slug: string; property_type: string; has_page: boolean } | null;
}

export interface ProductDetailPageProps {
  product?: Tables<'products'> & Record<string, unknown>;
  sectionSlug?: string;
}

export default function ProductDetailPage({
  product: initialProduct,
}: ProductDetailPageProps = {}) {
  const supabase = useSupabaseClient();
  const params = useParams({ strict: false }) as {
    sectionSlug?: string;
    productSlug?: string;
  };
  const productSlug = params.productSlug;
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const { addItem } = useCart();
  const { toast } = useToast();
  const { priceTypeId, defaultPriceTypeId } = usePriceType();
  const { data: discountGroups = [] } = useDiscountGroups();
  const discountCtx = useDiscountContext();

  // Fetch product with all related data
  const { data: product, isLoading } = useQuery({
    queryKey: ["public-product", productSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          *,
          sections(id, slug, name),
          product_modifications(*),
          product_prices(price_type_id, price, old_price, modification_id),
          product_property_values(
            property_id,
            value,
            numeric_value,
            option_id,
            property_options:option_id(id, slug),
            section_properties:property_id(id, name, slug, property_type, has_page)
          )
        `
        )
        .eq("slug", productSlug!)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    initialData: initialProduct,
  });

  // Fetch modification property values for all modifications
  const modificationIds = useMemo(() => {
    if (!product?.product_modifications) return [];
    return (product.product_modifications as Array<{ id: string }>).map((m) => m.id);
  }, [product]);

  const { data: modificationPropertyValues } = useQuery({
    queryKey: ["modification-property-values", modificationIds],
    queryFn: async () => {
      if (modificationIds.length === 0) return {};

      const { data, error } = await supabase
        .from("modification_property_values")
        .select(`
          modification_id,
          property_id,
          value,
          numeric_value,
          option_id,
          property_options:option_id(id, slug),
          section_properties:property_id(id, name, slug, property_type, has_page)
        `)
        .in("modification_id", modificationIds);

      if (error) throw error;

      // Group by modification_id
      const grouped: Record<string, PropertyValueItem[]> = {};
      data?.forEach(v => {
        if (!grouped[v.modification_id]) {
          grouped[v.modification_id] = [];
        }
        grouped[v.modification_id].push({
          property_id: v.property_id,
          value: v.value,
          numeric_value: v.numeric_value,
          option_id: v.option_id,
          option: v.property_options as PropertyValueItem['option'],
          property: v.section_properties as PropertyValueItem['property'],
        });
      });

      return grouped;
    },
    enabled: modificationIds.length > 0,
  });

  // Fetch stock info for all modifications
  const { data: modificationsStockData } = useQuery({
    queryKey: ["modifications-stock", modificationIds],
    queryFn: async () => {
      if (modificationIds.length === 0) return {};

      const stockMap: Record<string, ModificationStockInfo> = {};

      // Fetch stock data for all modifications in parallel
      await Promise.all(
        modificationIds.map(async (modId: string) => {
          const { data, error } = await supabase.rpc("get_stock_info", {
            p_product_id: undefined,
            p_modification_id: modId,
          });

          if (!error && data?.[0]) {
            const row = data[0];
            stockMap[modId] = {
              totalQuantity: row.total_quantity ?? 0,
              isAvailable: row.is_available ?? false,
            };
          } else {
            stockMap[modId] = { totalQuantity: 0, isAvailable: false };
          }
        })
      );

      return stockMap;
    },
    enabled: modificationIds.length > 0,
    staleTime: 30000,
  });

  // Get sorted modifications
  const modifications = useMemo(() => {
    if (!product?.product_modifications) return [];
    const mods = product.product_modifications as Array<{
      id: string;
      name: string;
      slug: string;
      is_default: boolean;
      sort_order: number;
      stock_status: 'in_stock' | 'out_of_stock' | 'on_order' | null;
      sku: string | null;
      images: unknown;
    }>;
    return [...mods].sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      return a.sort_order - b.sort_order;
    });
  }, [product]);

  // Check if product has modifications
  const hasModifications = product?.has_modifications ?? true;

  // Selected modification - sync with URL (only for products with modifications)
  const [selectedModId, setSelectedModId] = useState<string>("");
  const modSlugFromUrl = search.mod;

  useEffect(() => {
    if (!hasModifications || modifications.length === 0) return;

    // Визначаємо цільову модифікацію: з URL або за замовчуванням
    let targetMod = modSlugFromUrl
      ? modifications.find((m) => m.slug === modSlugFromUrl)
      : undefined;

    if (!targetMod && !selectedModId) {
      targetMod = modifications.find((m) => m.is_default) || modifications[0];
    }

    if (targetMod && targetMod.id !== selectedModId) {
      // Використовуємо flushSync-подібний підхід через callback ref
      const id = targetMod.id;
      const slug = targetMod.slug;
      // Batch: оновлюємо стан та URL разом
      setSelectedModId(id);
      if (slug) {
        navigate({ to: pathname, search: { mod: slug }, replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modifications, modSlugFromUrl, hasModifications]);

  const selectedMod = modifications.find((m) => m.id === selectedModId);

  // Handle modification selection with URL update
  const handleModificationSelect = useCallback((modId: string) => {
    const mod = modifications.find((m) => m.id === modId);
    if (mod) {
      setSelectedModId(modId);
      navigate({ to: pathname, search: { mod: mod.slug }, replace: true });
    }
  }, [modifications, navigate, pathname]);

  // Combine product and modification images
  const allImages = useMemo(() => {
    const productImages = Array.isArray(product?.images)
      ? (product.images as string[])
      : [];

    if (hasModifications && selectedMod) {
      const modImages = Array.isArray(selectedMod.images)
        ? (selectedMod.images as string[])
        : [];
      // Prefer modification images, fall back to product images
      return modImages.length > 0 ? modImages : productImages;
    }

    return productImages;
  }, [product, selectedMod, hasModifications]);

  // Property values with property info - combine product and selected modification properties
  const propertyValues = useMemo(() => {
    // Product-level properties
    const rawPropValues = product?.product_property_values as Array<{
      property_id: string;
      value: string | null;
      numeric_value: number | null;
      option_id: string | null;
      property_options: { id: string; slug: string } | null;
      section_properties: { id: string; name: string; slug: string; property_type: string; has_page: boolean } | null;
    }> || [];
    const productProps: PropertyValueItem[] = rawPropValues.map((pv) => ({
      property_id: pv.property_id,
      value: pv.value,
      numeric_value: pv.numeric_value,
      option_id: pv.option_id,
      option: pv.property_options,
      property: pv.section_properties,
    }));

    // Modification-level properties for selected modification
    const modProps: PropertyValueItem[] = selectedModId && modificationPropertyValues?.[selectedModId]
      ? modificationPropertyValues[selectedModId]
      : [];

    // Combine: modification properties override product properties with same property_id
    const propMap = new Map<string, PropertyValueItem>();
    productProps.forEach((pv) => propMap.set(pv.property_id, pv));
    modProps.forEach((pv) => propMap.set(pv.property_id, pv));

    return Array.from(propMap.values());
  }, [product, selectedModId, modificationPropertyValues]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: "UAH",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Build prices map for modifications (with discounts applied)
  const modPrices = useMemo(() => {
    const productPrices = (product?.product_prices ?? []) as PriceEntry[];
    const map: Record<string, { price: number; oldPrice: number | null }> = {};
    modifications.forEach((mod) => {
      const resolved = resolvePrice(productPrices, priceTypeId, defaultPriceTypeId, mod.id);
      if (resolved.price !== null) {
        let modPrice = resolved.price;
        let modOldPrice = resolved.oldPrice;

        // Apply discounts per modification
        if (discountGroups.length > 0) {
          const discountResult = applyDiscount(modPrice, discountGroups, {
            ...discountCtx,
            quantity: 1,
            cartTotal: 0,
            productId: product?.id || '',
            modificationId: mod.id,
            sectionId: (product?.sections as { id: string } | null)?.id || null,
          });
          if (discountResult.totalDiscount > 0) {
            modOldPrice = modPrice;
            modPrice = discountResult.finalPrice;
          }
        }

        map[mod.id] = { price: modPrice, oldPrice: modOldPrice };
      }
    });
    return map;
  }, [product, modifications, priceTypeId, defaultPriceTypeId, discountGroups, discountCtx]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">Товар не знайдено</h1>
        <Button onClick={() => window.history.back()}>Повернутись назад</Button>
      </div>
    );
  }

  const section = product.sections as { id: string; slug: string; name: string } | null;

  // Get price, stock, and SKU based on product type
  let stockStatus: string | null;
  let price: number | undefined;
  let oldPrice: number | null | undefined;
  let sku: string | null | undefined;

  const productPrices = (product.product_prices ?? []) as PriceEntry[];

  if (hasModifications) {
    stockStatus = selectedMod?.stock_status ?? "in_stock";
    const resolved = resolvePrice(productPrices, priceTypeId, defaultPriceTypeId, selectedMod?.id || null);
    price = resolved.price ?? undefined;
    oldPrice = resolved.oldPrice;
    sku = selectedMod?.sku;
  } else {
    stockStatus = product.stock_status ?? "in_stock";
    const resolved = resolvePrice(productPrices, priceTypeId, defaultPriceTypeId, null);
    price = resolved.price ?? undefined;
    oldPrice = resolved.oldPrice;
    sku = product.sku;
  }

  // Apply discounts
  let currentDiscountResult: ReturnType<typeof applyDiscount> | null = null;
  let basePrice: number | undefined;
  if (price !== undefined && discountGroups.length > 0) {
    currentDiscountResult = applyDiscount(price, discountGroups, {
      ...discountCtx,
      quantity: 1,
      cartTotal: 0,
      productId: product.id,
      modificationId: hasModifications ? selectedMod?.id || null : null,
      sectionId: section?.id || null,
    });
    if (currentDiscountResult.totalDiscount > 0) {
      basePrice = price;
      oldPrice = price;
      price = currentDiscountResult.finalPrice;
    }
  }

  const isInStock = stockStatus === "in_stock" || stockStatus === "on_order";

  const discountPercent =
    oldPrice && price && oldPrice > price
      ? Math.round(((oldPrice - price) / oldPrice) * 100)
      : null;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 flex-wrap">
        <Link to="/" className="hover:text-foreground transition-colors">
          Головна
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link to="/catalog" className="hover:text-foreground transition-colors">
          Каталог
        </Link>
        {section && (
          <>
            <ChevronRight className="h-4 w-4" />
            <Link
              to="/catalog/$sectionSlug"
              params={{ sectionSlug: section.slug }}
              className="hover:text-foreground transition-colors"
            >
              {section.name}
            </Link>
          </>
        )}
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div>
          <ProductGallery images={allImages} productName={product.name} />
        </div>

        {/* Product info */}
        <div className="space-y-6">
          {/* Plugin slot: before product info */}
          <PluginSlot name="product.detail.before" context={{ product, selectedMod }} />

          {/* Title and badges */}
          <div>
            {discountPercent && (
              <Badge variant="destructive" className="mb-2">-{discountPercent}%</Badge>
            )}
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl font-bold">{product.name}</h1>
              <div className="flex items-center gap-2 shrink-0 pt-1">
                {stockStatus === "on_order" && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/20">
                    Під замовлення
                  </Badge>
                )}
                {!isInStock && stockStatus !== "on_order" && (
                  <Badge variant="secondary">Немає в наявності</Badge>
                )}
                {/* Plugin slot: product badges */}
                <PluginSlot
                  name="product.card.badges"
                  context={{ product, selectedMod }}
                  wrapper={(children) => <>{children}</>}
                />
              </div>
            </div>
            {sku && (
              <p className="text-sm text-muted-foreground mt-1">
                Артикул: {sku}
              </p>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            {price !== undefined && (
              <span className="text-4xl font-bold text-primary">
                {formatPrice(price)}
              </span>
            )}
            {oldPrice && price && oldPrice > price && (
              <span className="text-xl text-muted-foreground line-through">
                {formatPrice(oldPrice)}
              </span>
            )}
          </div>

          <Separator />

          {/* Short description */}
          {product.short_description && (
            <p className="text-muted-foreground">{product.short_description}</p>
          )}

          {/* Modification selector - only for products with modifications */}
          {hasModifications && modifications.length > 0 && (
            <ModificationSelector
              modifications={modifications}
              selectedId={selectedModId}
              onSelect={handleModificationSelect}
              formatPrice={formatPrice}
              prices={modPrices}
              stockByModification={modificationsStockData}
            />
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="flex-1 min-w-50"
              disabled={!isInStock || price === undefined}
              onClick={() => {
                if (price === undefined) return;

                addItem({
                  productId: product.id,
                  modificationId: hasModifications ? selectedModId : null,
                  name: product.name,
                  modificationName: hasModifications ? selectedMod?.name : undefined,
                  price: price,
                  basePrice: basePrice || null,
                  discountData: currentDiscountResult && currentDiscountResult.totalDiscount > 0
                    ? JSON.parse(JSON.stringify({
                        appliedDiscounts: currentDiscountResult.appliedDiscounts,
                        totalDiscount: currentDiscountResult.totalDiscount,
                        basePrice: basePrice,
                      }))
                    : null,
                  image: allImages[0],
                  sku: sku || undefined,
                });

                toast({
                  title: "Додано в кошик",
                  description: `${product.name}${hasModifications && selectedMod ? ` (${selectedMod.name})` : ""}`,
                });
              }}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Додати в кошик
            </Button>
            <Button size="lg" variant="outline">
              <Heart className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline">
              <Share2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Section navigation */}
      <div className="mt-12 sticky top-0 z-10 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 border-b">
        <nav className="flex gap-1">
          <button
            onClick={() => document.getElementById('section-description')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-primary"
          >
            Опис
          </button>
          <button
            onClick={() => document.getElementById('section-characteristics')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-primary"
          >
            Характеристики
          </button>
          <button
            onClick={() => document.getElementById('section-availability')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-primary"
          >
            Наявність
          </button>
          <button
            onClick={() => document.getElementById('section-reviews')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-6 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-primary"
          >
            Відгуки
          </button>
        </nav>
      </div>

      {/* Description section */}
      <section id="section-description" className="mt-8 scroll-mt-16">
        <h2 className="text-xl font-semibold mb-4">Опис</h2>
        {product.description ? (
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        ) : (
          <p className="text-muted-foreground">Опис товару відсутній</p>
        )}
      </section>

      <Separator className="my-8" />

      {/* Characteristics section */}
      <section id="section-characteristics" className="scroll-mt-16">
        <h2 className="text-xl font-semibold mb-4">Характеристики</h2>
        <ProductCharacteristics propertyValues={propertyValues} />
      </section>

      <Separator className="my-8" />

      {/* Availability section */}
      <section id="section-availability" className="scroll-mt-16">
        <h2 className="text-xl font-semibold mb-4">Наявність на складах</h2>
        <StockDisplay
          productId={hasModifications ? null : product.id}
          modificationId={hasModifications ? selectedModId : null}
        />
      </section>

      <Separator className="my-8" />

      {/* Reviews section */}
      <section id="section-reviews" className="scroll-mt-16">
        <h2 className="text-xl font-semibold mb-4">Відгуки</h2>
        <ProductReviews productId={product.id} />
      </section>

      {/* Plugin slot: after product content */}
      <PluginSlot name="product.detail.after" context={{ product, selectedMod, propertyValues }} />
    </div>
  );
}
