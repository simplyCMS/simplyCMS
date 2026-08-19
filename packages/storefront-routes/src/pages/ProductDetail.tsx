import { useParams } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useT } from '@simplycms/i18n';
import { Button } from '@simplycms/ui/button';
import { ProductDetailView } from '../views/ProductDetailView';
import { useStorefrontViews } from '../views/useStorefrontViews';
import { buildBreadcrumbs } from './product-detail/breadcrumbs';
import { buildCartItem } from './product-detail/cart-item';
import {
  ProductDetailSlotBindings,
  type ProductDetailBindings,
} from './product-detail/slot-context';
import { productDetailSlots } from './product-detail/slots';
import { useModificationData } from './product-detail/useModificationData';
import { useModificationSelection } from './product-detail/useModificationSelection';
import { useProductContent } from './product-detail/useProductContent';
import { useProductPricing } from './product-detail/useProductPricing';
import { useProductQuery } from './product-detail/useProductQuery';
import type {
  ProductDetailProduct,
  ProductSectionRef,
} from './product-detail/types';

export interface ProductDetailPageProps {
  product?: ProductDetailProduct;
  sectionSlug?: string;
}

/**
 * Контейнер картки товару: тягне дані, тримає стан вибору модифікації,
 * збирає view-model зі сталими реквізитами — і віддає його view (темовому,
 * якщо тема його заявила, інакше канонічному).
 */
export default function ProductDetailPage({
  product: initialProduct,
}: ProductDetailPageProps = {}) {
  const t = useT();
  const params = useParams({ strict: false }) as {
    sectionSlug?: string;
    productSlug?: string;
  };

  const { data: product, isLoading } = useProductQuery(
    params.productSlug,
    initialProduct,
  );

  const hasModifications = product?.has_modifications ?? true;
  const section = (product?.sections ?? null) as ProductSectionRef | null;

  const { modifications, propertyValuesByModification, stockByModification } =
    useModificationData(product);
  const { selectedModId, selectedMod, onSelect } = useModificationSelection(
    modifications,
    hasModifications,
  );
  const { images, propertyValues } = useProductContent({
    product,
    hasModifications,
    selectedMod,
    selectedModId,
    propertyValuesByModification,
  });
  const { modificationPrices, current } = useProductPricing({
    product,
    section,
    hasModifications,
    modifications,
    selectedMod,
  });
  const views = useStorefrontViews({ ProductDetail: ProductDetailView });

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product || !current) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">{t('product.notFound')}</h1>
        <Button onClick={() => window.history.back()}>
          {t('product.goBack')}
        </Button>
      </div>
    );
  }

  const pluginContext = { product, selectedMod };
  const bindings: ProductDetailBindings = {
    pluginContext,
    pluginAfterContext: { product, selectedMod, propertyValues },
    stockStatus: current.stockStatus,
    price: current.price,
    oldPrice: current.oldPrice,
    modifications: hasModifications ? modifications : [],
    selectedModId,
    onSelectModification: onSelect,
    modificationPrices,
    stockByModification,
    cartItem: buildCartItem({
      product,
      hasModifications,
      selectedModId,
      selectedMod,
      current,
      image: images[0],
    }),
    isInStock: current.isInStock,
    availabilityProductId: hasModifications ? null : product.id,
    availabilityModificationId: hasModifications ? selectedModId : null,
    productId: product.id,
  };

  return (
    <ProductDetailSlotBindings value={bindings}>
      <views.ProductDetail
        breadcrumbs={buildBreadcrumbs(t, section, product.name)}
        gallery={{ images }}
        summary={{
          name: product.name,
          sku: current.sku ?? null,
          short_description: product.short_description,
          discountPercent: current.discountPercent,
        }}
        description={{ html: product.description }}
        characteristics={{ items: propertyValues }}
        slots={productDetailSlots}
      />
    </ProductDetailSlotBindings>
  );
}
