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
import { ui } from '../../../test-harness/locale';

// Мова рендеру — параметр kit-а без дефолту: тут явно `uk`.
const assertUk = (theme: Parameters<typeof assertThemeViewsConformance>[0]) =>
  assertThemeViewsConformance(theme, { locale: ui('uk') });

/**
 * Негативний контроль conformance-kit-а (Р8).
 *
 * 🔴 Зелений kit, який не вміє червоніти, гірший за відсутній: він дає
 * автору теми хибну впевненість. Тому на кожне «має пройти» тут є парне
 * «має впасти» — і саме на тому дефекті, заради якого гейт існує.
 */
describe('assertThemeViewsConformance — склад реквізитів', () => {
  it('тема без views — чесний pass: перевіряти нема чого', async () => {
    await expect(assertUk(makeTheme())).resolves.toEqual([]);
  });

  it('валідна тема з views — зелено', async () => {
    const theme = makeTheme({
      ProductDetail: GoodProductDetail,
      Cart: GoodCart,
    });

    await expect(assertUk(theme)).resolves.toEqual(['ProductDetail', 'Cart']);
  });

  it('загублений slots.AddToCart — червоно, з назвою реквізиту', async () => {
    const theme = makeTheme({ ProductDetail: ProductDetailWithoutAddToCart });

    await expect(assertUk(theme)).rejects.toThrow(
      /views\.ProductDetail[\s\S]*product-detail\.add-to-cart/,
    );
  });

  it('падіння на порожньому кошику — червоно, зі станом у тексті', async () => {
    const theme = makeTheme({ Cart: CartCrashingWhenEmpty });

    await expect(assertUk(theme)).rejects.toThrow(/views\.Cart[\s\S]*"edge"/);
  });

  it('порожній кошик без реквізитів — НЕ дефект (спека §5)', async () => {
    const theme = makeTheme({ Cart: GoodCart });

    await expect(assertUk(theme)).resolves.toEqual(['Cart']);
  });

  it('валідні Home/Catalog/CatalogSection — зелено, і прогнані всі три', async () => {
    const theme = makeTheme({
      Home: GoodHome,
      Catalog: GoodCatalog,
      CatalogSection: GoodCatalogSection,
    });

    await expect(assertUk(theme)).resolves.toEqual([
      'Home',
      'Catalog',
      'CatalogSection',
    ]);
  });

  it('падіння головної на магазині без категорій — червоно', async () => {
    const theme = makeTheme({ Home: HomeCrashingWithoutSections });

    await expect(assertUk(theme)).rejects.toThrow(/views\.Home[\s\S]*"edge"/);
  });

  it('каталог без slots.ProductGrid — червоно, з назвою реквізиту', async () => {
    const theme = makeTheme({ Catalog: CatalogWithoutProductGrid });

    await expect(assertUk(theme)).rejects.toThrow(
      /views\.Catalog[\s\S]*catalog\.product-grid/,
    );
  });

  it('розділ без slots.ProductGrid — червоно, з назвою реквізиту', async () => {
    const theme = makeTheme({
      CatalogSection: CatalogSectionWithoutProductGrid,
    });

    await expect(assertUk(theme)).rejects.toThrow(
      /views\.CatalogSection[\s\S]*catalog\.product-grid/,
    );
  });

  it('невідомий ключ views — падає ще на валідації контракту', async () => {
    const theme = makeTheme();
    Object.assign(theme, { views: { Checkout: GoodCart } });

    await expect(assertUk(theme)).rejects.toThrow(/невідомий views\.Checkout/);
  });
});
