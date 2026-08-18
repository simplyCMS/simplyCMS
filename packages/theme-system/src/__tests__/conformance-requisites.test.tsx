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

/**
 * Негативний контроль conformance-kit-а (Р8).
 *
 * 🔴 Зелений kit, який не вміє червоніти, гірший за відсутній: він дає
 * автору теми хибну впевненість. Тому на кожне «має пройти» тут є парне
 * «має впасти» — і саме на тому дефекті, заради якого гейт існує.
 */
describe('assertThemeViewsConformance — склад реквізитів', () => {
  it('тема без views — чесний pass: перевіряти нема чого', async () => {
    await expect(
      assertThemeViewsConformance(makeTheme()),
    ).resolves.toBeUndefined();
  });

  it('валідна тема з views — зелено', async () => {
    const theme = makeTheme({
      ProductDetail: GoodProductDetail,
      Cart: GoodCart,
    });

    await expect(assertThemeViewsConformance(theme)).resolves.toBeUndefined();
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

    await expect(assertThemeViewsConformance(theme)).resolves.toBeUndefined();
  });

  it('невідомий ключ views — падає ще на валідації контракту', async () => {
    const theme = makeTheme();
    Object.assign(theme, { views: { Checkout: GoodCart } });

    await expect(assertThemeViewsConformance(theme)).rejects.toThrow(
      /невідомий views\.Checkout/,
    );
  });
});
