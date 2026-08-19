// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { assertThemeViewsConformance } from '../conformance';
import {
  CartCrashingWhenEmpty,
  GoodCart,
  GoodProductDetail,
  ProductDetailWithoutAddToCart,
  makeTheme,
} from './conformance-themes';
import {
  CatalogSectionWithoutProductGrid,
  CatalogWithoutProductGrid,
  GoodCatalog,
  GoodCatalogSection,
  GoodHome,
  HomeCrashingWithoutSections,
} from './conformance-themes-pages';

/**
 * Негативний контроль conformance-kit-а (Р8).
 *
 * 🔴 Зелений kit, який не вміє червоніти, гірший за відсутній: він дає
 * автору теми хибну впевненість. Тому на кожне «має пройти» тут є парне
 * «має впасти» — і саме на тому дефекті, заради якого гейт існує.
 */
describe('assertThemeViewsConformance — склад реквізитів', () => {
  it('тема без views — чесний pass: перевіряти нема чого', async () => {
    await expect(assertThemeViewsConformance(makeTheme())).resolves.toEqual([]);
  });

  it('валідна тема з views — зелено', async () => {
    const theme = makeTheme({
      ProductDetail: GoodProductDetail,
      Cart: GoodCart,
    });

    await expect(assertThemeViewsConformance(theme)).resolves.toEqual([
      'ProductDetail',
      'Cart',
    ]);
  });

  it('загублений slots.AddToCart — червоно, з назвою реквізиту', async () => {
    const theme = makeTheme({ ProductDetail: ProductDetailWithoutAddToCart });

    await expect(assertThemeViewsConformance(theme)).rejects.toThrow(
      /views\.ProductDetail[\s\S]*product-detail\.add-to-cart/,
    );
  });

  it('падіння на порожньому кошику — червоно, зі станом у тексті', async () => {
    const theme = makeTheme({ Cart: CartCrashingWhenEmpty });

    await expect(assertThemeViewsConformance(theme)).rejects.toThrow(
      /views\.Cart[\s\S]*"edge"/,
    );
  });

  it('порожній кошик без реквізитів — НЕ дефект (спека §5)', async () => {
    const theme = makeTheme({ Cart: GoodCart });

    await expect(assertThemeViewsConformance(theme)).resolves.toEqual(['Cart']);
  });

  it('валідні Home/Catalog/CatalogSection — зелено, і прогнані всі три', async () => {
    const theme = makeTheme({
      Home: GoodHome,
      Catalog: GoodCatalog,
      CatalogSection: GoodCatalogSection,
    });

    await expect(assertThemeViewsConformance(theme)).resolves.toEqual([
      'Home',
      'Catalog',
      'CatalogSection',
    ]);
  });

  it('падіння головної на магазині без категорій — червоно', async () => {
    const theme = makeTheme({ Home: HomeCrashingWithoutSections });

    await expect(assertThemeViewsConformance(theme)).rejects.toThrow(
      /views\.Home[\s\S]*"edge"/,
    );
  });

  it('каталог без slots.ProductGrid — червоно, з назвою реквізиту', async () => {
    const theme = makeTheme({ Catalog: CatalogWithoutProductGrid });

    await expect(assertThemeViewsConformance(theme)).rejects.toThrow(
      /views\.Catalog[\s\S]*catalog\.product-grid/,
    );
  });

  it('розділ без slots.ProductGrid — червоно, з назвою реквізиту', async () => {
    const theme = makeTheme({
      CatalogSection: CatalogSectionWithoutProductGrid,
    });

    await expect(assertThemeViewsConformance(theme)).rejects.toThrow(
      /views\.CatalogSection[\s\S]*catalog\.product-grid/,
    );
  });

  it('невідомий ключ views — падає ще на валідації контракту', async () => {
    const theme = makeTheme();
    Object.assign(theme, { views: { Checkout: GoodCart } });

    await expect(assertThemeViewsConformance(theme)).rejects.toThrow(
      /невідомий views\.Checkout/,
    );
  });
});
