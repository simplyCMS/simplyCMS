import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadHomePageData,
  loadHomeProducts,
  loadOneSectionProducts,
  loadRootSections,
  resolveTextLocale,
  withStorefrontDb,
  withViewerDb,
} from 'simplycms/storefront/loaders';

/** Мова читання тексту товарів: дає її роут (з префікса адреси), не сесія. */
const localeInput = z.object({ locale: z.string().min(1) });

/**
 * Дані головної — однією транзакцією. Прайси карток у цьому файлі — лише
 * видів глядача сесії, залогіненому `private, no-store` (Р29, `withViewerDb`).
 */
export const getHomePageData = createServerFn({ method: 'GET' })
  .validator(localeInput)
  .handler(async ({ data: input }) => {
    const text = await resolveTextLocale((input as { locale: string }).locale);
    return withViewerDb((db, viewer) => loadHomePageData(db, viewer, text));
  });

/** Популярні товари (`is_featured`) — канонічна добірка головної. */
export const getFeaturedProducts = createServerFn({ method: 'GET' })
  .validator(localeInput)
  .handler(async ({ data: input }) => {
    const text = await resolveTextLocale((input as { locale: string }).locale);
    return withViewerDb((db, viewer) =>
      loadHomeProducts(db, true, viewer, text),
    );
  });

/** Новинки — канонічна добірка головної. */
export const getNewProducts = createServerFn({ method: 'GET' })
  .validator(localeInput)
  .handler(async ({ data: input }) => {
    const text = await resolveTextLocale((input as { locale: string }).locale);
    return withViewerDb((db, viewer) =>
      loadHomeProducts(db, false, viewer, text),
    );
  });

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
      locale: z.string().min(1),
    }),
  )
  .handler(async ({ data: input }) => {
    const { locale, ...section } = input as {
      id: string;
      name: string;
      slug: string;
      locale: string;
    };
    const text = await resolveTextLocale(locale);
    return withViewerDb((db, viewer) =>
      loadOneSectionProducts(db, section, viewer, text),
    );
  });
