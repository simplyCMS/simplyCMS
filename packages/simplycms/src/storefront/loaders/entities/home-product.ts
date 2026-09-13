import { products } from 'simplycms/schema';
import type { Product } from 'simplycms/schema/types';
import type { ResolvedPrice } from 'simplycms/domain/pricing';
import { toImageList } from './product';

/** Мінімальний товар для карток головної. */
export const homeProductColumns = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  images: products.images,
  short_description: products.shortDescription,
  stock_status: products.stockStatus,
};

export interface HomeProductRow {
  id: Product['id'];
  name: Product['name'];
  slug: Product['slug'];
  images: string[];
  short_description: Product['shortDescription'];
  stock_status: Product['stockStatus'];
  /** Slug розділу — потрібен лише для href картки. */
  section: { slug: string } | null;
  price: number | null;
  old_price: number | null;
}

/** Сирий рядок картки: `images` — нетипізований jsonb. */
export interface RawHomeProductRow {
  id: string;
  name: string;
  slug: string;
  images: unknown;
  short_description: string | null;
  stock_status: Product['stockStatus'];
}

export function toHomeProduct(
  row: RawHomeProductRow,
  sectionSlug: string | null,
  price: ResolvedPrice,
): HomeProductRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    images: toImageList(row.images),
    short_description: row.short_description,
    stock_status: row.stock_status,
    section: sectionSlug === null ? null : { slug: sectionSlug },
    price: price.price,
    old_price: price.oldPrice,
  };
}
