import { and, eq } from 'drizzle-orm';
import {
  productPrices,
  productPropertyValues,
  propertyOptions,
  sectionProperties,
} from 'simplycms/schema';
import type { PriceEntry } from 'simplycms/contracts';
import type { ActorDb } from './db';
import { type ProductRow } from './entities/product';
import { toGallery } from './entities/gallery';
import { type ModificationRow } from './entities/modification';
import {
  loadGuestPriceTypes,
  priceColumns,
  toPriceEntry,
  visibleToViewer,
  type PriceTypes,
  type ViewerPriceTypes,
} from 'simplycms/commerce';
import { type SectionRef } from './entities/section';
import { propertyValueColumns } from './property-values';
import type { ProductPropertyValueRow } from './property-values';
import { loadProductModifications } from './product-modifications';
import { loadProductValueTexts, withValueTexts } from './value-texts';
import {
  loadProductPageBase,
  type ProductAddress,
  type ProductPage,
} from './product-page';

export type { ProductAddress, ProductPage } from './product-page';

/** Товар сторінки картки разом з усіма приєднаними гілками. */
export type ProductDetailRow = ProductRow & {
  sections: SectionRef | null;
  product_modifications: ModificationRow[];
  /** Лише види цін глядача (Р29): гість — гостьові, покупець — свій + гостьові. */
  product_prices: PriceEntry[];
  product_property_values: ProductPropertyValueRow[];
  /**
   * Типи ціни ГОСТЯ (F9): JSON-LD `offers` рахує ними ту саму базу, що SSR-
   * списки й картка гостя після гідрації. Персональний тип сюди не йде:
   * розмітка для пошуковика одна для всіх (К3-Е6в-1), а гостьові види є в
   * `product_prices` і в покупця — як фолбек (Р29).
   */
  guest_price_types: PriceTypes;
  /** Мова сторінки, адреса, SEO-політика і поля з fallback (М1, І33/І37). */
  page: ProductPage;
};

/**
 * Товар за адресою з реєстру `(мова, шлях)` — з розділом, модифікаціями, цінами
 * й характеристиками.
 *
 * 🔴 Текст і адреса — з проєкції `catalog_product_texts` у мові запиту (П7), не з
 * колонок `products`. Модифікації і текстові значення властивостей — з
 * `withFallback` (мова, інакше основна). `slug` рядка — поточна адреса мови.
 *
 * 🔴 `is_active = true` тут ОБОВʼЯЗКОВИЙ: без нього чернетка товару відкривалася
 * б прямим посиланням і потрапляла в JSON-LD. Мова — лише `published`.
 *
 * 🔴 Ціни — лише видів `viewer` (Р29): гість гуртового прайсу не дістає ні в
 * payload, ні в SSR-HTML. Набір рахує `withViewerDb` із серверної сесії.
 */
export async function loadProduct(
  db: ActorDb,
  address: ProductAddress,
  viewer: ViewerPriceTypes,
): Promise<ProductDetailRow | null> {
  const base = await loadProductPageBase(db, address);
  if (!base) return null;

  // Послідовно — причина та сама, що в `./products`: одне зʼєднання.
  const { product, page } = base;
  const modificationRows = await loadProductModifications(
    db,
    product.id,
    page.locale,
    page.primary,
  );
  const priceRows = await db
    .select(priceColumns)
    .from(productPrices)
    .where(
      and(eq(productPrices.productId, product.id), visibleToViewer(viewer)),
    );
  const propertyValueRows = await db
    .select(propertyValueColumns)
    .from(productPropertyValues)
    .leftJoin(
      propertyOptions,
      eq(productPropertyValues.optionId, propertyOptions.id),
    )
    .leftJoin(
      sectionProperties,
      eq(productPropertyValues.propertyId, sectionProperties.id),
    )
    .where(eq(productPropertyValues.productId, product.id));
  const valueTexts = await loadProductValueTexts(
    db,
    'product',
    propertyValueRows.map((r) => r.value_id),
    page.locale,
    page.primary,
  );
  const guestPriceTypes = await loadGuestPriceTypes(db);

  return {
    ...product,
    ...base.text,
    slug: page.path,
    images: toGallery(product.images),
    sections: base.section,
    product_modifications: modificationRows,
    product_prices: priceRows.map(toPriceEntry),
    product_property_values: withValueTexts(propertyValueRows, valueTexts),
    guest_price_types: guestPriceTypes,
    page,
  };
}
