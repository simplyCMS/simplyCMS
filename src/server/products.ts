import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadProduct,
  loadProducts,
  loadProductsBySectionId,
} from '@simplycms/storefront/loaders';
import { createServerSupabase } from '@simplycms/supabase/server-client';

/** Отримати товар за slug (для сторінки товару) */
export const getProduct = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { slug } = input as { slug: string };
    return loadProduct(createServerSupabase(), slug);
  });

/** Отримати всі активні товари (каталог) */
export const getProducts = createServerFn({ method: 'GET' }).handler(
  async () => loadProducts(createServerSupabase()),
);

/** Отримати товари за ID секції */
export const getProductsBySectionId = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ sectionId: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { sectionId } = input as { sectionId: string };
    return loadProductsBySectionId(createServerSupabase(), sectionId);
  });
