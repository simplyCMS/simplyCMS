import { createServerFn } from '@tanstack/react-start';
import { createServerSupabase } from './supabase';
import { parseBannerRow } from '@simplycms/core/lib/bannerUtils';

/** Скорочений select для карточки товару на головній */
const HOME_PRODUCT_SELECT = `
  id, name, slug, images, short_description,
  stock_status, section_id,
  sections!products_section_id_fkey(slug)
` as const;

/** Отримати дані головної сторінки одним RPC-викликом */
export const getHomePageData = createServerFn({ method: 'GET' })
  .handler(async () => {
    const supabase = createServerSupabase();

    const [banners, featured, newProducts, sections] = await Promise.all([
      supabase
        .from('banners')
        .select('*')
        .eq('is_active', true),
      supabase
        .from('products')
        .select(HOME_PRODUCT_SELECT)
        .eq('is_active', true)
        .eq('is_featured', true)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('products')
        .select(HOME_PRODUCT_SELECT)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(12),
      supabase
        .from('sections')
        .select('id, name, slug')
        .eq('is_active', true)
        .is('parent_id', null)
        .order('sort_order'),
    ]);

    return {
      banners: (banners.data ?? []).map(parseBannerRow),
      featuredProducts: (featured.data ?? []).map(mapHomeProduct),
      newProducts: (newProducts.data ?? []).map(mapHomeProduct),
      sections: sections.data ?? [],
    };
  });

/** Трансформація продукту для картки на головній */
function mapHomeProduct(p: Record<string, unknown>) {
  return {
    id: p.id as string,
    name: p.name as string,
    slug: p.slug as string,
    images: (p.images as string[]) || [],
    short_description: p.short_description as string | null,
    stock_status: p.stock_status as string,
    section: p.sections
      ? { slug: (p.sections as { slug: string }).slug }
      : null,
  };
}
