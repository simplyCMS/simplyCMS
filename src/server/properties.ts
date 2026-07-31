import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadProperties,
  loadPropertyBySlug,
  loadPropertyOption,
} from '@simplycms/storefront/loaders';
import { createServerSupabase } from './supabase';

/** Отримати всі характеристики з has_page=true */
export const getProperties = createServerFn({ method: 'GET' }).handler(
  async () => loadProperties(createServerSupabase()),
);

/** Отримати характеристику за slug з опціями */
export const getPropertyBySlug = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { slug } = input as { slug: string };
    return loadPropertyBySlug(createServerSupabase(), slug);
  });

/** Отримати опцію характеристики з повʼязаними товарами */
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
    return loadPropertyOption(createServerSupabase(), propertySlug, optionSlug);
  });
