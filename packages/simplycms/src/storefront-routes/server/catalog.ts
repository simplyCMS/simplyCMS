import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadCatalogProducts,
  loadFilterOptions,
  loadSectionBySlug,
  loadSectionNumericProperties,
  loadSections,
  withStorefrontDb,
  type SectionRow,
} from 'simplycms/storefront/loaders';
import type { ProductListPayload } from './product-list-item';
import { loadProductListPayload } from './product-list-payload';

export interface CatalogPageData {
  sections: SectionRow[];
  products: ProductListPayload;
}

export interface SectionPageData extends CatalogPageData {
  section: SectionRow;
}

/**
 * Каталог цілком: розділи, товари й контекст цін.
 *
 * 🔴 Один serverFn замість трьох. Роут раніше збирав сторінку з окремих
 * викликів, і кожен відкривав ВЛАСНУ транзакцію — тобто сторінка складалася
 * з різних знімків БД і платила зайвими раундтрипами. Тут усе в одній.
 */
export const getCatalogPageData = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CatalogPageData> =>
    withStorefrontDb(async (db) => ({
      sections: await loadSections(db),
      products: await loadProductListPayload(db),
    })),
);

/**
 * Сторінка розділу. `null` означає «розділу немає або він неактивний» —
 * рішення про 404 лишається роуту.
 *
 * 🔴 Саме тут був водоспад: роут спершу чекав на `getSectionBySlug` і лише
 * потім починав тягнути розділи й товари — два послідовні походи на сервер
 * замість одного.
 */
export const getSectionPageData = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: input }): Promise<SectionPageData | null> => {
    const { slug } = input as { slug: string };

    return withStorefrontDb(async (db) => {
      const section = await loadSectionBySlug(db, slug);
      if (!section) return null;

      return {
        section,
        sections: await loadSections(db),
        products: await loadProductListPayload(db, section.id),
      };
    });
  });

/** Активні розділи — чипси над списком товарів. */
export const getCatalogSections = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SectionRow[]> => withStorefrontDb((db) => loadSections(db)),
);

/** Розділ поточної сторінки за slug; `null` — немає або неактивний. */
export const getCatalogSection = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: input }): Promise<SectionRow | null> => {
    const { slug } = input as { slug: string };
    return withStorefrontDb((db) => loadSectionBySlug(db, slug));
  });

/**
 * Вибірка каталогу з модифікаціями, цінами, характеристиками й наявністю.
 *
 * `sectionId` відсутній — сторінка каталогу (розділ обирається чипсами на
 * клієнті); заданий — сторінка розділу, вибірка звужена запитом.
 */
export const getCatalogProducts = createServerFn({ method: 'GET' })
  .validator(z.object({ sectionId: z.string().min(1).optional() }))
  .handler(async ({ data: input }) => {
    const { sectionId } = input as { sectionId?: string };
    return withStorefrontDb((db) => loadCatalogProducts(db, sectionId));
  });

/** Числові характеристики розділу, за якими можна фільтрувати. */
export const getSectionNumericProperties = createServerFn({ method: 'GET' })
  .validator(z.object({ sectionId: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { sectionId } = input as { sectionId: string };
    return withStorefrontDb((db) =>
      loadSectionNumericProperties(db, sectionId),
    );
  });

/** Опції характеристик — назви для бейджів активних фільтрів. */
export const getFilterOptions = createServerFn({ method: 'GET' }).handler(
  async () => withStorefrontDb((db) => loadFilterOptions(db)),
);
