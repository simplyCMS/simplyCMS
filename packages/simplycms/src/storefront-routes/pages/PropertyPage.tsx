import { RichHtml } from 'simplycms/ui/rich-html';
import { useMemo } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useT } from 'simplycms/i18n';
import { ProductCard } from 'simplycms/core/components/catalog/ProductCard';
import { Loader2, ChevronRight } from 'lucide-react';
import { Button } from 'simplycms/ui/button';
import { useDiscountEnvironment } from 'simplycms/core/hooks/useDiscountEnvironment';
import { AGGREGATE } from 'simplycms/contracts/entities';
import type {
  CatalogProductRow,
  OptionRow,
  PropertyOptionPageData,
  PropertyRow,
} from 'simplycms/storefront/loaders';
import { PricesFailure } from '../components/PricesFailure';
import { getPropertyOption } from '../server/properties';
import { priceCatalogRow } from './pricing/priceCatalogRow';

export interface PropertyOptionPageProps {
  property?: PropertyRow;
  option?: OptionRow;
  products?: CatalogProductRow[];
}

export default function PropertyPage({
  property: initialProperty,
  option: initialOption,
  products: initialProducts,
}: PropertyOptionPageProps = {}) {
  const t = useT();
  const params = useParams({ strict: false }) as Record<
    string,
    string | undefined
  >;
  const propertySlug = params?.propertySlug as string | undefined;
  const optionSlug = params?.optionSlug as string | undefined;

  const {
    data: env,
    isError: pricesFailed,
    refetch: retryPrices,
  } = useDiscountEnvironment();

  /**
   * 🔴 Один серверний виклик замість чотирьох клієнтських запитів
   * (характеристика → опція → id товарів двома вибірками → самі товари).
   * Обидва рівні характеристики — товар і модифікація — обʼєднані в SQL, тож
   * список більше не залежить від того, скільки id влізе в `in (…)`.
   */
  const initialData: PropertyOptionPageData | undefined =
    initialProperty && initialOption
      ? {
          property: initialProperty,
          option: initialOption,
          products: initialProducts ?? [],
        }
      : undefined;

  const { data, isLoading } = useQuery({
    queryKey: [...AGGREGATE.propertyOptionPage.key, propertySlug, optionSlug],
    queryFn: (): Promise<PropertyOptionPageData | null> =>
      getPropertyOption({
        data: {
          propertySlug: propertySlug as string,
          optionSlug: optionSlug as string,
        },
      }),
    enabled: !!propertySlug && !!optionSlug,
    initialData,
  });

  const property = data?.property ?? null;
  const option = data?.option ?? null;
  const optionLoading = isLoading;
  const productsLoading = isLoading;

  // Ціни — тим самим `priceForCard`, що каталог і головна (Е6в-11). До
  // середовища картки лишаються без ціни, як і в серверному HTML; збій
  // середовища — помилка з «Повторити» замість сітки (F1).
  const products = useMemo(() => {
    if (!data) return undefined;
    if (!env) return data.products;
    return data.products.map((p) => priceCatalogRow(p, env));
  }, [data, env]);

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
          <RichHtml
            className="prose prose-lg max-w-none text-muted-foreground dark:prose-invert"
            html={description}
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
        ) : pricesFailed ? (
          <PricesFailure onRetry={retryPrices} className="py-12" />
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
