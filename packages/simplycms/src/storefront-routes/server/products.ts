import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { loadProduct, withStorefrontDb } from 'simplycms/storefront/loaders';

/** Отримати товар за slug (для сторінки товару). */
export const getProduct = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { slug } = input as { slug: string };
    return withStorefrontDb((db) => loadProduct(db, slug));
  });
