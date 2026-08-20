// Складання прогонів conformance: заявлений темою view × фікстурні стани.
//
// 🔴 Пʼять явних блоків замість циклу по `THEME_VIEW_KEYS` — навмисно.
// Кожна сторінка має ВЛАСНИЙ тип view-model і власний набір слотів, тож
// узагальнений цикл вимагав би приведення типів (`as`), яке саме тут і
// маскувало б розсинхрон контракту. Явні блоки типізуються повністю: новий
// ключ у `ThemeViews` без блоку тут просто не перевіряється, а зміна форми
// vm — червоний `pnpm typecheck`.

import type { ReactElement } from 'react';
import type { StorefrontViewName } from 'simplycms/contracts/views';
import { viewModelFixtures } from 'simplycms/contracts/views/fixtures';
import type { ThemeViews } from '../types';
import {
  cartSlotStubs,
  catalogSlotStubs,
  homeSlotStubs,
  productDetailSlotStubs,
} from './stubs';

/**
 * Стани, на яких ганяється кожен view: `full` — повні дані (на ньому
 * асертиться склад реквізитів), `edge` — крайній (товар без фото, порожній
 * кошик, порожня секція; тут доводиться лише те, що рендер не падає).
 */
export const CONFORMANCE_STATES = ['full', 'edge'] as const;

export type ConformanceState = (typeof CONFORMANCE_STATES)[number];

export interface ConformanceCase {
  name: StorefrontViewName;
  states: Record<ConformanceState, ReactElement>;
}

export function buildConformanceCases(views: ThemeViews): ConformanceCase[] {
  const cases: ConformanceCase[] = [];

  const Home = views.Home;
  if (Home) {
    const fixtures = viewModelFixtures.Home;
    cases.push({
      name: 'Home',
      states: {
        full: <Home {...fixtures.full} slots={homeSlotStubs} />,
        edge: <Home {...fixtures.edge} slots={homeSlotStubs} />,
      },
    });
  }

  const Catalog = views.Catalog;
  if (Catalog) {
    const fixtures = viewModelFixtures.Catalog;
    cases.push({
      name: 'Catalog',
      states: {
        full: <Catalog {...fixtures.full} slots={catalogSlotStubs} />,
        edge: <Catalog {...fixtures.edge} slots={catalogSlotStubs} />,
      },
    });
  }

  const CatalogSection = views.CatalogSection;
  if (CatalogSection) {
    const fixtures = viewModelFixtures.CatalogSection;
    cases.push({
      name: 'CatalogSection',
      states: {
        full: <CatalogSection {...fixtures.full} slots={catalogSlotStubs} />,
        edge: <CatalogSection {...fixtures.edge} slots={catalogSlotStubs} />,
      },
    });
  }

  const ProductDetail = views.ProductDetail;
  if (ProductDetail) {
    const fixtures = viewModelFixtures.ProductDetail;
    cases.push({
      name: 'ProductDetail',
      states: {
        full: (
          <ProductDetail {...fixtures.full} slots={productDetailSlotStubs} />
        ),
        edge: (
          <ProductDetail {...fixtures.edge} slots={productDetailSlotStubs} />
        ),
      },
    });
  }

  const Cart = views.Cart;
  if (Cart) {
    const fixtures = viewModelFixtures.Cart;
    cases.push({
      name: 'Cart',
      states: {
        full: <Cart {...fixtures.full} slots={cartSlotStubs} />,
        edge: <Cart {...fixtures.edge} slots={cartSlotStubs} />,
      },
    });
  }

  return cases;
}
