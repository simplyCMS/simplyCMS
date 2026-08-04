import type { Banner, BannerButton } from '@simplycms/objects';
import type { StorefrontClient } from '../client';

/** Перетворює рядок banners на доменний Banner (раніше — core/lib/bannerUtils). */
function mapBannerRow(row: Record<string, unknown>): Banner {
  return {
    ...(row as unknown as Banner),
    buttons: parseBannerButtons(row.buttons),
    schedule_days: Array.isArray(row.schedule_days)
      ? (row.schedule_days as number[])
      : null,
  };
}

function parseBannerButtons(raw: unknown): BannerButton[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isBannerButton);
}

function isBannerButton(item: unknown): item is BannerButton {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.text === 'string' &&
    typeof obj.url === 'string' &&
    typeof obj.target === 'string' &&
    typeof obj.variant === 'string'
  );
}

/** Скорочений select для карточки товару на головній */
const HOME_PRODUCT_SELECT = `
  id, name, slug, images, short_description,
  stock_status, section_id,
  sections!products_section_id_fkey(slug)
` as const;

/** Select картки товару секційної добірки — джойн зайвий, slug секції відомий */
const SECTION_PRODUCT_SELECT =
  'id, name, slug, images, short_description, stock_status' as const;

/**
 * Кореневий розділ каталогу у виборці фази 1.
 *
 * Експортується, бо тече у публічний тип `loadHomePageData`: без цього
 * споживач (`@simplycms/storefront-routes`) не може іменувати тип під час
 * емісії власних `.d.ts` (TS4023).
 */
export interface RootSection {
  id: string;
  name: string;
  slug: string;
}

/**
 * Отримати дані головної сторінки.
 *
 * Двофазний алгоритм: фаза 1 — банери/добірки/кореневі секції одним
 * `Promise.all`; фаза 2 — по одному запиту `limit(8)` на кожну кореневу
 * секцію. Per-section limit одним запитом PostgREST не вміє, тому N запитів
 * свідомо виконуються на сервері одним SSR-батчем — це прибирає N+1 з
 * клієнта (RPC — пізніша оптимізація).
 */
export async function loadHomePageData(client: StorefrontClient) {
  const [banners, featured, newProducts, sections] = await Promise.all([
    client.from('banners').select('*').eq('is_active', true),
    client
      .from('products')
      .select(HOME_PRODUCT_SELECT)
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('created_at', { ascending: false })
      .limit(12),
    client
      .from('products')
      .select(HOME_PRODUCT_SELECT)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(12),
    client
      .from('sections')
      .select('id, name, slug')
      .eq('is_active', true)
      .is('parent_id', null)
      .order('sort_order'),
  ]);

  if (banners.error) throw banners.error;
  if (featured.error) throw featured.error;
  if (newProducts.error) throw newProducts.error;
  if (sections.error) throw sections.error;

  const rootSections = (sections.data ?? []) as RootSection[];

  return {
    banners: (banners.data ?? []).map(mapBannerRow),
    featuredProducts: (featured.data ?? []).map(mapHomeProduct),
    newProducts: (newProducts.data ?? []).map(mapHomeProduct),
    sections: rootSections,
    sectionProducts: await loadSectionProducts(client, rootSections),
  };
}

/** Фаза 2: товари кожної кореневої секції → мапа `sectionId → товари` */
async function loadSectionProducts(
  client: StorefrontClient,
  sections: RootSection[],
): Promise<Record<string, ReturnType<typeof mapHomeProduct>[]>> {
  const responses = await Promise.all(
    sections.map((section) =>
      client
        .from('products')
        .select(SECTION_PRODUCT_SELECT)
        .eq('is_active', true)
        .eq('section_id', section.id)
        .order('created_at', { ascending: false })
        .limit(8),
    ),
  );

  const bySection: Record<string, ReturnType<typeof mapHomeProduct>[]> = {};
  responses.forEach((response, index) => {
    if (response.error) throw response.error;
    const section = sections[index];
    const rows = (response.data ?? []) as Record<string, unknown>[];
    bySection[section.id] = rows.map((row) => ({
      ...mapHomeProduct(row),
      section: { slug: section.slug },
    }));
  });

  return bySection;
}

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
