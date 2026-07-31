import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@simplycms/supabase/SupabaseProvider';
import type { HomeProduct, HomeSection } from './types';

/** Скорочений select для картки товару на головній */
const HOME_PRODUCT_SELECT =
  'id, name, slug, images, short_description, stock_status, section_id, sections!products_section_id_fkey(slug)';

/** Рядок товару з `sections`-джойном */
type ProductRow = {
  id: string;
  name: string;
  slug: string;
  images: unknown;
  short_description: string | null;
  stock_status: string | null;
  sections: { slug: string } | null;
};

function mapProduct(row: ProductRow): HomeProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    images: Array.isArray(row.images) ? (row.images as string[]) : [],
    short_description: row.short_description,
    stock_status: row.stock_status,
    section: row.sections ? { slug: row.sections.slug } : null,
  };
}

/** Популярні товари (`is_featured`) — канонічна добірка головної */
export function useFeaturedProducts(initialData?: HomeProduct[]) {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: ['featured-products'],
    queryFn: async (): Promise<HomeProduct[]> => {
      const { data, error } = await supabase
        .from('products')
        .select(HOME_PRODUCT_SELECT)
        .eq('is_active', true)
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw error;

      return (data ?? []).map((row) => mapProduct(row as ProductRow));
    },
    initialData,
  });
}

/** Новинки — канонічна добірка головної */
export function useNewProducts(initialData?: HomeProduct[]) {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: ['new-products'],
    queryFn: async (): Promise<HomeProduct[]> => {
      const { data, error } = await supabase
        .from('products')
        .select(HOME_PRODUCT_SELECT)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw error;

      return (data ?? []).map((row) => mapProduct(row as ProductRow));
    },
    initialData,
  });
}

/** Кореневі категорії каталогу */
export function useRootSections(initialData?: HomeSection[]) {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: ['root-sections'],
    queryFn: async (): Promise<HomeSection[]> => {
      const { data, error } = await supabase
        .from('sections')
        .select('id, name, slug')
        .eq('is_active', true)
        .is('parent_id', null)
        .order('sort_order');
      if (error) throw error;

      return data ?? [];
    },
    initialData,
  });
}

/** Опції посекційної добірки: `initialData` приходить із SSR-лоадера */
export interface SectionProductsOptions {
  initialData?: HomeProduct[];
}

/**
 * Товари однієї категорії — для посекційної добірки.
 *
 * Дані префетчить SSR-лоадер головної й передає через `initialData`: разом зі
 * `staleTime` це прибирає N+1 (карусель більше не ходить у Supabase з клієнта).
 */
export function useSectionProducts(
  section: HomeSection,
  options?: SectionProductsOptions,
) {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: ['section-products', section.id],
    initialData: options?.initialData,
    staleTime: 60_000,
    queryFn: async (): Promise<HomeProduct[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, images, short_description, stock_status')
        .eq('is_active', true)
        .eq('section_id', section.id)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;

      return (data ?? []).map((row) => ({
        ...mapProduct({ ...(row as ProductRow), sections: null }),
        section: { slug: section.slug },
      }));
    },
  });
}
