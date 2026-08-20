import { useMemo } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from 'simplycms/supabase/SupabaseProvider';
import { useT } from 'simplycms/i18n';
import { ProductCard } from '@simplycms/core/components/catalog/ProductCard';
import { Loader2, ChevronRight } from 'lucide-react';
import { Button } from 'simplycms/ui/button';
import { usePriceType } from '@simplycms/core/hooks/usePriceType';
import { resolvePrice, type PriceEntry } from '@simplycms/core/lib/priceUtils';
import type { Tables } from 'simplycms/supabase';

export interface PropertyOptionPageProps {
  property?: Tables<'section_properties'> & Record<string, unknown>;
  option?: Tables<'property_options'> & Record<string, unknown>;
  products?: Array<Tables<'products'> & Record<string, unknown>>;
}

export default function PropertyPage({
  property: initialProperty,
  option: initialOption,
  products: _initialProducts,
}: PropertyOptionPageProps = {}) {
  const t = useT();
  const supabase = useSupabaseClient();
  const params = useParams({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const propertySlug = params?.propertySlug as string | undefined;
  const optionSlug = params?.optionSlug as string | undefined;

  const { priceTypeId, defaultPriceTypeId } = usePriceType();
  const propertyCode = propertySlug;

  // Fetch property by slug
  const { data: property } = useQuery({
    queryKey: ['property-by-slug', propertyCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('section_properties')
        .select('*')
        .eq('slug', propertyCode!)
        .eq('has_page', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!propertyCode,
    initialData: initialProperty,
  });

  // Fetch option by slug (now includes page data)
  const { data: option, isLoading: optionLoading } = useQuery({
    queryKey: ['property-option-by-slug', property?.id, optionSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_options')
        .select('*')
        .eq('property_id', property!.id)
        .eq('slug', optionSlug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!property?.id && !!optionSlug,
    initialData: initialOption,
  });

  // Fetch products with this property value
  const { data: rawProducts, isLoading: productsLoading } = useQuery({
    queryKey: ['products-by-option', option?.id],
    queryFn: async () => {
      if (!option?.id) return [];

      // Get product IDs that have this option at product level
      const { data: productLevelValues, error: pvError } = await supabase
        .from('product_property_values')
        .select('product_id')
        .eq('option_id', option.id);

      if (pvError) throw pvError;

      // Get modification IDs that have this option at modification level
      const { data: modLevelValues, error: mvError } = await supabase
        .from('modification_property_values')
        .select('modification_id, product_modifications!inner(product_id)')
        .eq('option_id', option.id);

      if (mvError) throw mvError;

      // Combine unique product IDs
      const productIds = new Set<string>();
      productLevelValues?.forEach((pv) => productIds.add(pv.product_id));
      modLevelValues?.forEach((mv) => {
        const productId = (
          mv.product_modifications as { product_id: string } | null
        )?.product_id;
        if (productId) productIds.add(productId);
      });

      if (productIds.size === 0) return [];

      const { data, error } = await supabase
        .from('products')
        .select(
          `
          *,
          sections(id, slug, name),
          product_modifications(id, stock_status, is_default, sort_order),
          product_prices(price_type_id, price, old_price, modification_id)
        `,
        )
        .in('id', Array.from(productIds))
        .eq('is_active', true);

      if (error) throw error;

      return data.map((product) => {
        const mods = product.product_modifications || [];
        const defaultMod =
          mods.find((m) => m.is_default) ||
          [...mods].sort((a, b) => a.sort_order - b.sort_order)[0];
        const images = product.images as string[] | null;
        return {
          ...product,
          has_modifications: product.has_modifications ?? false,
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
      const prices = (p.product_prices ?? []) as PriceEntry[];
      const hasModifications = p.has_modifications ?? true;
      let resolved;
      if (hasModifications && p.modifications?.[0]) {
        resolved = resolvePrice(
          prices,
          priceTypeId,
          defaultPriceTypeId,
          p.modifications[0].id,
        );
      } else {
        resolved = resolvePrice(prices, priceTypeId, defaultPriceTypeId, null);
      }
      const stockStatus = hasModifications
        ? (p.modifications?.[0]?.stock_status ?? 'in_stock')
        : (p.stock_status ?? 'in_stock');
      return {
        ...p,
        price: resolved.price,
        old_price: resolved.oldPrice,
        stock_status: stockStatus,
      };
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
        <h1 className="text-2xl font-bold mb-4">
          {t('properties.pageNotFound')}
        </h1>
        <Link to="/catalog">
          <Button>{t('catalog.back')}</Button>
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
          {t('breadcrumbs.home')}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link
          to="/properties"
          className="hover:text-foreground transition-colors"
        >
          {t('properties.title')}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link
          to="/properties/$propertySlug"
          params={{ propertySlug: property?.slug ?? '' }}
          className="hover:text-foreground transition-colors"
        >
          {property?.name}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{displayName}</span>
      </nav>

      {/* Hero section */}
      <div className="mb-8">
        {imageUrl && (
          <div className="relative w-full h-48 md:h-64 mb-6 rounded-xl overflow-hidden">
            <img
              src={imageUrl}
              alt={displayName}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
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
          {property?.name
            ? t('properties.productsFiltered', {
                property: property.name,
                option: option.name,
              })
            : t('properties.products')}
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
              {t('properties.productsEmpty')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
