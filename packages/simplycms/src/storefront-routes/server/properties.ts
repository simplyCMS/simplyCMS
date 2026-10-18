import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadProperties,
  loadPropertyBySlug,
  loadPropertyOption,
  resolveTextLocale,
  withStorefrontDb,
  withViewerDb,
} from 'simplycms/storefront/loaders';
import { localeInput } from 'simplycms/core/lib/locale-input';

/** Отримати всі характеристики з публічною сторінкою. */
export const getProperties = createServerFn({ method: 'GET' }).handler(
  async () => withStorefrontDb((db) => loadProperties(db)),
);

/** Отримати характеристику за slug разом з опціями. */
export const getPropertyBySlug = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { slug } = input as { slug: string };
    return withStorefrontDb((db) => loadPropertyBySlug(db, slug));
  });

/** Опція характеристики з товарами; ціни — лише видів глядача (Р29). */
export const getPropertyOption = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      propertySlug: z.string().min(1),
      optionSlug: z.string().min(1),
      locale: localeInput,
    }),
  )
  .handler(async ({ data: input }) => {
    const { propertySlug, optionSlug, locale } = input as {
      propertySlug: string;
      optionSlug: string;
      locale: string;
    };
    const text = await resolveTextLocale(locale);
    return withViewerDb((db, viewer) =>
      loadPropertyOption(db, propertySlug, optionSlug, viewer, text),
    );
  });
