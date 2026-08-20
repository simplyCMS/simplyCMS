import { describe, expect, it } from 'vitest';
import { viewModelFixtures } from '../views/fixtures';
import type {
  CartViewModel,
  CatalogSectionViewModel,
  CatalogViewModel,
  HomeViewModel,
  ProductDetailViewModel,
  ViewModelData,
} from '../views';

// Парність фікстур і типів (Р6). Компіляційний бік доводять анотації нижче:
// присвоєння фікстури типу `ViewModelData<T>` не пройде typecheck, якщо тип
// сторінки й фікстура розійшлися. Рантайм-бік — асерти форми: саме на цих
// обʼєктах conformance-kit рендерить views без БД.

const home: ViewModelData<HomeViewModel> = viewModelFixtures.Home.full;
const catalog: ViewModelData<CatalogViewModel> = viewModelFixtures.Catalog.full;
const catalogSection: ViewModelData<CatalogSectionViewModel> =
  viewModelFixtures.CatalogSection.full;
const productDetail: ViewModelData<ProductDetailViewModel> =
  viewModelFixtures.ProductDetail.full;
const cart: ViewModelData<CartViewModel> = viewModelFixtures.Cart.full;

describe('фікстурні view-model-и', () => {
  // 🔴 Список ключів тут ЛІТЕРАЛЬНИЙ: objects — T0 і не має права залежати
  // від theme-system, де живе `THEME_VIEW_KEYS`. Звірку двох списків робить
  // тест у theme-system (він залежить від objects, не навпаки).
  it('покривають рівно пʼять канонічних сторінок', () => {
    expect(Object.keys(viewModelFixtures).sort()).toEqual([
      'Cart',
      'Catalog',
      'CatalogSection',
      'Home',
      'ProductDetail',
    ]);
  });

  it('кожна сторінка має стан full і крайній стан edge', () => {
    for (const [page, states] of Object.entries(viewModelFixtures)) {
      expect(Object.keys(states).sort(), page).toEqual(['edge', 'full']);
    }
  });

  it('не несуть слотів — слоти підставляє споживач', () => {
    for (const [page, states] of Object.entries(viewModelFixtures)) {
      for (const [state, vm] of Object.entries(states)) {
        expect(vm, `${page}.${state}`).not.toHaveProperty('slots');
      }
    }
  });

  it('повні стани мають секційну структуру сторінок', () => {
    expect(home.hero.banners).toHaveLength(1);
    expect(home.featured.products.length).toBeGreaterThan(0);
    expect(home.newArrivals.products.length).toBeGreaterThan(0);
    expect(home.sections.items).toHaveLength(1);

    expect(productDetail.gallery.images.length).toBeGreaterThan(0);
    expect(productDetail.summary.name).not.toBe('');
    expect(productDetail.description.html).not.toBeNull();
    expect(productDetail.characteristics.items.length).toBeGreaterThan(0);

    expect(catalog.productCount).toBeGreaterThan(0);
    expect(catalogSection.section.description).not.toBeNull();
    expect(cart.itemCount).toBeGreaterThan(0);
  });

  it('крайні стани справді крайні (порожні дані, а не копія full)', () => {
    const homeEdge = viewModelFixtures.Home.edge;
    expect(homeEdge.hero.banners).toEqual([]);
    expect(homeEdge.featured.products).toEqual([]);
    expect(homeEdge.sections.items).toEqual([]);

    const productEdge = viewModelFixtures.ProductDetail.edge;
    expect(productEdge.gallery.images).toEqual([]);
    expect(productEdge.summary.sku).toBeNull();
    expect(productEdge.characteristics.items).toEqual([]);

    expect(viewModelFixtures.Cart.edge.itemCount).toBe(0);
    expect(viewModelFixtures.Catalog.edge.productCount).toBe(0);
    expect(
      viewModelFixtures.CatalogSection.edge.section.description,
    ).toBeNull();
  });

  it('хлібні крихти закінчуються поточною сторінкою без href', () => {
    for (const crumbs of [
      catalog.breadcrumbs,
      catalogSection.breadcrumbs,
      productDetail.breadcrumbs,
      cart.breadcrumbs,
    ]) {
      expect(crumbs.length).toBeGreaterThan(1);
      expect(crumbs[crumbs.length - 1].href).toBeUndefined();
    }
  });
});
