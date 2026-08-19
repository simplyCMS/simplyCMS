// Стаби комерційних реквізитів для conformance-рендеру (контракт тем v3).
//
// 🔴 Kit НЕ бачить реальних слотів: вони живуть у `@simplycms/storefront-routes`
// (T5), а theme-system — нижчий тір і залежати від route-пакета не має права.
// Тому слот тут підмінено мінімальним стабом, який малює ЛИШЕ маркер — рівно
// той контракт, на якому тримається перевірка складу реквізитів. Наслідок,
// про який варто памʼятати: kit доводить, що тема РОЗСТАВИЛА слот, а не те,
// що прибінджена ядром логіка всередині нього працює (це доводять юніти
// самих слотів).

import type { ReactElement } from 'react';
import {
  CART_REQUISITES,
  CATALOG_REQUISITES,
  HOME_REQUISITES,
  PRODUCT_DETAIL_REQUISITES,
  REQUISITE_ATTRIBUTE,
  type CartSlots,
  type CatalogSlots,
  type HomeSlots,
  type ProductDetailSlots,
} from '@simplycms/objects/views';

/** Атрибут-маркер береться з контракту, а не дублюється рядком. */
function markerProps(name: string): Record<string, string> {
  return { [REQUISITE_ATTRIBUTE]: name };
}

function requisiteStub(name: string): () => ReactElement {
  return function RequisiteStub() {
    return <div {...markerProps(name)} />;
  };
}

export const homeSlotStubs: HomeSlots = {
  SectionCarousel: requisiteStub(HOME_REQUISITES.SectionCarousel),
};

export const catalogSlotStubs: CatalogSlots = {
  SectionChips: requisiteStub(CATALOG_REQUISITES.SectionChips),
  Filters: requisiteStub(CATALOG_REQUISITES.Filters),
  SortSelect: requisiteStub(CATALOG_REQUISITES.SortSelect),
  ViewModeToggle: requisiteStub(CATALOG_REQUISITES.ViewModeToggle),
  ActiveFilters: requisiteStub(CATALOG_REQUISITES.ActiveFilters),
  ProductGrid: requisiteStub(CATALOG_REQUISITES.ProductGrid),
};

export const productDetailSlotStubs: ProductDetailSlots = {
  PluginBefore: requisiteStub(PRODUCT_DETAIL_REQUISITES.PluginBefore),
  StockBadge: requisiteStub(PRODUCT_DETAIL_REQUISITES.StockBadge),
  PluginBadges: requisiteStub(PRODUCT_DETAIL_REQUISITES.PluginBadges),
  PriceBlock: requisiteStub(PRODUCT_DETAIL_REQUISITES.PriceBlock),
  ModificationSelector: requisiteStub(
    PRODUCT_DETAIL_REQUISITES.ModificationSelector,
  ),
  AddToCart: requisiteStub(PRODUCT_DETAIL_REQUISITES.AddToCart),
  StockAvailability: requisiteStub(PRODUCT_DETAIL_REQUISITES.StockAvailability),
  Reviews: requisiteStub(PRODUCT_DETAIL_REQUISITES.Reviews),
  PluginAfter: requisiteStub(PRODUCT_DETAIL_REQUISITES.PluginAfter),
};

export const cartSlotStubs: CartSlots = {
  Items: requisiteStub(CART_REQUISITES.Items),
  ClearCart: requisiteStub(CART_REQUISITES.ClearCart),
  Summary: requisiteStub(CART_REQUISITES.Summary),
  Checkout: requisiteStub(CART_REQUISITES.Checkout),
};
