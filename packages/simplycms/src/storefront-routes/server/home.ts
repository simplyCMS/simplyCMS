import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadHomePageData,
  loadHomeProducts,
  loadOneSectionProducts,
  loadRootSections,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';

/** Отримати дані головної сторінки — однією транзакцією вітрини. */
export const getHomePageData = createServerFn({ method: 'GET' }).handler(
  async () => withStorefrontDb((db) => loadHomePageData(db)),
);

/** Популярні товари (`is_featured`) — канонічна добірка головної. */
export const getFeaturedProducts = createServerFn({ method: 'GET' }).handler(
  async () => withStorefrontDb((db) => loadHomeProducts(db, true)),
);

/** Новинки — канонічна добірка головної. */
export const getNewProducts = createServerFn({ method: 'GET' }).handler(
  async () => withStorefrontDb((db) => loadHomeProducts(db, false)),
);

/** Кореневі розділи каталогу. */
export const getRootSections = createServerFn({ method: 'GET' }).handler(
  async () => withStorefrontDb((db) => loadRootSections(db)),
);

/**
 * Товари однієї категорії — для посекційної добірки.
 *
 * `slug` приймається разом з `id` не для вибірки, а для href карток: той
 * самий запит на головній має і те, і те з лоадера, тож зайвого походу за
 * розділом тут не виникає.
 */
export const getSectionProducts = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      slug: z.string().min(1),
    }),
  )
  .handler(async ({ data: input }) => {
    const section = input as { id: string; name: string; slug: string };
    return withStorefrontDb((db) => loadOneSectionProducts(db, section));
  });
