import { products } from 'simplycms/schema';
import type { Product } from 'simplycms/schema/types';
import type { PriceTypes } from 'simplycms/commerce';
import type { PriceEntry } from 'simplycms/contracts';
import { resolvePrice } from 'simplycms/domain/pricing';
import { toImageList } from './product';

/** Мінімальний товар для карток головної. */
export const homeProductColumns = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  images: products.images,
  short_description: products.shortDescription,
  stock_status: products.stockStatus,
  section_id: products.sectionId,
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
  /** Розділ — ціль знижок `section` для `priceForCard` (Е6в-11). */
  section_id: Product['sectionId'];
  /** Ціна за ДЕФОЛТНИМ типом — серверний HTML до гідрації. */
  price: number | null;
  old_price: number | null;
  /**
   * Прайс товару: базу за типом ціни покупця й знижку рахує клієнт
   * (`priceForCard`) — та сама функція, що в каталозі.
   */
  prices: PriceEntry[];
}

/** Сирий рядок картки: `images` — нетипізований jsonb. */
export interface RawHomeProductRow {
  id: string;
  name: string;
  slug: string;
  images: unknown;
  short_description: string | null;
  stock_status: Product['stockStatus'];
  section_id: Product['sectionId'];
}

export function toHomeProduct(
  row: RawHomeProductRow,
  sectionSlug: string | null,
  prices: PriceEntry[],
  priceTypes: PriceTypes,
): HomeProductRow {
  // SSR-ціна — ТИМ САМИМ доменним резолвом, що в каталозі
  // (`product-list-item`): окремий MIN(price)-агрегат був би другим способом
  // рахувати ціну. Типи — гостьові (`loadGuestPriceTypes`, F5b).
  const ssr = resolvePrice(
    prices,
    priceTypes.priceTypeId,
    priceTypes.defaultPriceTypeId,
  );
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    images: toImageList(row.images),
    short_description: row.short_description,
    stock_status: row.stock_status,
    section: sectionSlug === null ? null : { slug: sectionSlug },
    section_id: row.section_id,
    price: ssr.price,
    old_price: ssr.oldPrice,
    prices,
  };
}
