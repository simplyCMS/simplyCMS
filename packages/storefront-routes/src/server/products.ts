import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  loadProduct,
  loadProducts,
  loadProductsBySectionId,
  loadDefaultPriceTypeId,
} from 'simplycms/storefront/loaders';
import { createServerSupabase } from 'simplycms/supabase/server-client';
import {
  toProductListItem,
  type PriceContext,
  type ProductListItem,
  type ProductListRow,
} from './product-list-item';

/** Список товарів для SSR разом із контекстом цін — одним раундтрипом. */
export interface ProductListPayload {
  items: ProductListItem[];
  priceContext: PriceContext;
}

/** Мапить рядки select-у в DTO списку за спільним контекстом цін. */
function toPayload(
  rows: ProductListRow[],
  defaultPriceTypeId: string | null,
): ProductListPayload {
  const priceContext: PriceContext = { defaultPriceTypeId };
  return {
    items: rows.map((row) => toProductListItem(row, priceContext)),
    priceContext,
  };
}

/** Отримати товар за slug (для сторінки товару) */
export const getProduct = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data: input }) => {
    const { slug } = input as { slug: string };
    return loadProduct(createServerSupabase(), slug);
  });

/** Отримати всі активні товари (каталог) — готовий SSR-список + контекст цін */
export const getProducts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProductListPayload> => {
    const client = createServerSupabase();
    const [rows, defaultPriceTypeId] = await Promise.all([
      loadProducts(client),
      loadDefaultPriceTypeId(client),
    ]);
    return toPayload(rows as ProductListRow[], defaultPriceTypeId);
  },
);

/** Отримати товари за ID секції — готовий SSR-список + контекст цін */
export const getProductsBySectionId = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ sectionId: z.string().min(1) }))
  .handler(async ({ data: input }): Promise<ProductListPayload> => {
    const { sectionId } = input as { sectionId: string };
    const client = createServerSupabase();
    const [rows, defaultPriceTypeId] = await Promise.all([
      loadProductsBySectionId(client, sectionId),
      loadDefaultPriceTypeId(client),
    ]);
    return toPayload(rows as ProductListRow[], defaultPriceTypeId);
  });
