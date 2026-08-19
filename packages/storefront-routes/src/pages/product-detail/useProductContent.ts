// Зображення й характеристики картки: обидва залежать від вибраної модифікації.

import { useMemo } from 'react';
import type { ProductPropertyValueViewModel } from '@simplycms/objects/views';
import type { ProductDetailProduct, ProductModificationRow } from './types';

export interface ProductContentInput {
  product: ProductDetailProduct | null | undefined;
  hasModifications: boolean;
  selectedMod: ProductModificationRow | undefined;
  selectedModId: string;
  propertyValuesByModification:
    Record<string, ProductPropertyValueViewModel[]> | undefined;
}

export interface ProductContent {
  images: string[];
  propertyValues: ProductPropertyValueViewModel[];
}

/** Сировина «неціновної» частини картки: галерея + характеристики. */
export function useProductContent({
  product,
  hasModifications,
  selectedMod,
  selectedModId,
  propertyValuesByModification,
}: ProductContentInput): ProductContent {
  // Зображення товару й модифікації разом
  const images = useMemo(() => {
    const productImages = Array.isArray(product?.images)
      ? (product.images as string[])
      : [];

    if (hasModifications && selectedMod) {
      const modImages = Array.isArray(selectedMod.images)
        ? (selectedMod.images as string[])
        : [];
      // Фото модифікації пріоритетніші, інакше — фото товару
      return modImages.length > 0 ? modImages : productImages;
    }

    return productImages;
  }, [product, selectedMod, hasModifications]);

  // Характеристики товару + характеристики вибраної модифікації
  const propertyValues = useMemo(() => {
    const rawPropValues =
      (product?.product_property_values as Array<{
        property_id: string;
        value: string | null;
        numeric_value: number | null;
        option_id: string | null;
        property_options: { id: string; slug: string } | null;
        section_properties: {
          id: string;
          name: string;
          slug: string;
          property_type: string;
          has_page: boolean;
        } | null;
      }>) || [];
    const productProps: ProductPropertyValueViewModel[] = rawPropValues.map(
      (pv) => ({
        property_id: pv.property_id,
        value: pv.value,
        numeric_value: pv.numeric_value,
        option_id: pv.option_id,
        option: pv.property_options,
        property: pv.section_properties,
      }),
    );

    const modProps: ProductPropertyValueViewModel[] =
      selectedModId && propertyValuesByModification?.[selectedModId]
        ? propertyValuesByModification[selectedModId]
        : [];

    // Характеристики модифікації перекривають однойменні характеристики товару
    const propMap = new Map<string, ProductPropertyValueViewModel>();
    productProps.forEach((pv) => propMap.set(pv.property_id, pv));
    modProps.forEach((pv) => propMap.set(pv.property_id, pv));

    return Array.from(propMap.values());
  }, [product, selectedModId, propertyValuesByModification]);

  return { images, propertyValues };
}
