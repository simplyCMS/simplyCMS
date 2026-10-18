import { products } from 'simplycms/schema';
import { productGallerySql } from 'simplycms/translations';
import type { Product } from 'simplycms/schema/types';
import type { PriceTypes } from 'simplycms/commerce';
import type { PriceEntry } from 'simplycms/contracts';
import type { ProductImageViewModel } from 'simplycms/contracts/views';
import type { TextLocale } from 'simplycms/domain/translations';
import { resolvePrice } from 'simplycms/domain/pricing';
import { toGallery } from './gallery';
import { listLangs, listTextColumns } from '../product-list-text';

/**
 * Мінімальний товар для карток головної. Назва, адреса й короткий опис — з проєкції
 * `catalog_product_texts` у мові запиту (П7); запит приєднує її через `textJoinOn`.
 * Фото — галерея тієї ж мови (Task 17б), тож мапа колонок — функція мови.
 */
export const homeProductColumns = (text: TextLocale) => ({
  id: products.id,
  name: listTextColumns.name,
  slug: listTextColumns.slug,
  images: productGallerySql(products.id, text.locale, text.primary).as(
    'images',
  ),
  short_description: listTextColumns.short_description,
  fallback: listTextColumns.fallback,
  stock_status: products.stockStatus,
  section_id: products.sectionId,
});

export interface HomeProductRow {
  id: Product['id'];
  name: string;
  /** Поточна адреса товару в мові запиту (не основної мови). */
  slug: string;
  images: ProductImageViewModel[];
  short_description: string | null;
  /** Мова назви/короткого опису, коли текст узято з основної мови (fallback). */
  name_lang: string | null;
  short_description_lang: string | null;
  stock_status: Product['stockStatus'];
  /** Slug розділу — дані картки для теми; href від нього не залежить (адреса — `slug`). */
  section: { slug: string } | null;
  /** Розділ — ціль знижок `section` для `priceForCard` (Е6в-11). */
  section_id: Product['sectionId'];
  /** Ціна за ДЕФОЛТНИМ типом — серверний HTML до гідрації. */
  price: number | null;
  old_price: number | null;
  /**
   * Прайс товару — лише види цін глядача (Р29, фільтр у лоадері): базу за
   * типом ціни покупця й знижку рахує клієнт (`priceForCard`) — та сама
   * функція, що в каталозі.
   */
  prices: PriceEntry[];
}

/** Сирий рядок картки: `images` — нетипізований jsonb-масив галереї. */
export interface RawHomeProductRow {
  id: string;
  name: string;
  slug: string;
  images: unknown;
  short_description: string | null;
  /** Поля тексту, узяті з основної мови (колонка проєкції `fallback_fields`). */
  fallback: readonly string[];
  stock_status: Product['stockStatus'];
  section_id: Product['sectionId'];
}

export function toHomeProduct(
  row: RawHomeProductRow,
  sectionSlug: string | null,
  prices: PriceEntry[],
  priceTypes: PriceTypes,
  primary: string,
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
    images: toGallery(row.images),
    short_description: row.short_description,
    ...listLangs(row.fallback, primary),
    stock_status: row.stock_status,
    section: sectionSlug === null ? null : { slug: sectionSlug },
    section_id: row.section_id,
    price: ssr.price,
    old_price: ssr.oldPrice,
    prices,
  };
}
