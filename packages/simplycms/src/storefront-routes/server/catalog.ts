import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadCatalogProducts,
  loadDefaultPriceTypeId,
  loadFilterOptions,
  loadProductList,
  loadSectionBySlug,
  loadSectionNumericProperties,
  loadSections,
  withStorefrontDb,
  type ActorDb,
  type SectionRow,
} from 'simplycms/storefront/loaders';
import {
  toProductListPayload,
  type ProductListPayload,
} from './product-list-item';

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
      products: await loadProductPayload(db),
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
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: input }): Promise<SectionPageData | null> => {
    const { slug } = input as { slug: string };

    return withStorefrontDb(async (db) => {
      const section = await loadSectionBySlug(db, slug);
      if (!section) return null;

      return {
        section,
        sections: await loadSections(db),
        products: await loadProductPayload(db, section.id),
      };
    });
  });

/** Список товарів + контекст цін: тип ціни резолвиться в тій самій транзакції. */
async function loadProductPayload(
  db: ActorDb,
  sectionId?: string,
): Promise<ProductListPayload> {
  // Послідовно: транзакція живе на одному зʼєднанні (див. `storefront/loaders`).
  const rows = await loadProductList(db, sectionId);
  const defaultPriceTypeId = await loadDefaultPriceTypeId(db);

  return toProductListPayload(rows, defaultPriceTypeId);
}

/** Активні розділи — чипси над списком товарів. */
export const getCatalogSections = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SectionRow[]> => withStorefrontDb((db) => loadSections(db)),
);

/** Розділ поточної сторінки за slug; `null` — немає або неактивний. */
export const getCatalogSection = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1) }))
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
  .inputValidator(z.object({ sectionId: z.string().min(1).optional() }))
  .handler(async ({ data: input }) => {
    const { sectionId } = input as { sectionId?: string };
    return withStorefrontDb((db) => loadCatalogProducts(db, sectionId));
  });

/** Числові характеристики розділу, за якими можна фільтрувати. */
export const getSectionNumericProperties = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ sectionId: z.string().min(1) }))
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
