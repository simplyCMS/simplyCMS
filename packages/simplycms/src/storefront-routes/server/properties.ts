import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadProperties,
  loadPropertyBySlug,
  loadPropertyOption,
  withStorefrontDb,
} from 'simplycms/storefront/loaders';

/** Отримати всі характеристики з публічною сторінкою. */
export const getProperties = createServerFn({ method: 'GET' }).handler(
  async () => withStorefrontDb((db) => loadProperties(db)),
);

/** Отримати характеристику за slug разом з опціями. */
export const getPropertyBySlug = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { slug } = input as { slug: string };
    return withStorefrontDb((db) => loadPropertyBySlug(db, slug));
  });

/** Отримати опцію характеристики з повʼязаними товарами. */
export const getPropertyOption = createServerFn({ method: 'GET' })
  .inputValidator(
    z.object({
      propertySlug: z.string().min(1),
      optionSlug: z.string().min(1),
    }),
  )
  .handler(async ({ data: input }) => {
    const { propertySlug, optionSlug } = input as {
      propertySlug: string;
      optionSlug: string;
    };
    return withStorefrontDb((db) =>
      loadPropertyOption(db, propertySlug, optionSlug),
    );
  });
