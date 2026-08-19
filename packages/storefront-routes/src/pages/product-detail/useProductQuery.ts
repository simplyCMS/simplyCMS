// Запит товару картки (винесено з контейнера без зміни поведінки).

import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import type { ProductDetailProduct } from './types';

const PRODUCT_SELECT = `
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
        `;

/**
 * Товар з усіма приєднаними даними. SSR-значення приходить `initialData` —
 * саме тому сторінка не блимає лоадером після гідрації.
 */
export function useProductQuery(
  productSlug: string | undefined,
  initialProduct?: ProductDetailProduct,
) {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: ['public-product', productSlug],
    queryFn: async (): Promise<ProductDetailProduct | null> => {
      const { data, error } = await supabase
        .from('products')
        .select(PRODUCT_SELECT)
        .eq('slug', productSlug!)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as ProductDetailProduct | null;
    },
    initialData: initialProduct,
  });
}
