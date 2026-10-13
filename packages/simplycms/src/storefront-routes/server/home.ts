import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadHomePageData,
  loadHomeProducts,
  loadOneSectionProducts,
  loadRootSections,
  withStorefrontDb,
  withViewerDb,
} from 'simplycms/storefront/loaders';

/**
 * Дані головної — однією транзакцією. Прайси карток у цьому файлі — лише
 * видів глядача сесії, залогіненому `private, no-store` (Р29, `withViewerDb`).
 */
export const getHomePageData = createServerFn({ method: 'GET' }).handler(
  async () => withViewerDb((db, viewer) => loadHomePageData(db, viewer)),
);

/** Популярні товари (`is_featured`) — канонічна добірка головної. */
export const getFeaturedProducts = createServerFn({ method: 'GET' }).handler(
  async () => withViewerDb((db, viewer) => loadHomeProducts(db, true, viewer)),
);

/** Новинки — канонічна добірка головної. */
export const getNewProducts = createServerFn({ method: 'GET' }).handler(
  async () => withViewerDb((db, viewer) => loadHomeProducts(db, false, viewer)),
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
  .validator(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      slug: z.string().min(1),
    }),
  )
  .handler(async ({ data: input }) => {
    const section = input as { id: string; name: string; slug: string };
    return withViewerDb((db, viewer) =>
      loadOneSectionProducts(db, section, viewer),
    );
  });
