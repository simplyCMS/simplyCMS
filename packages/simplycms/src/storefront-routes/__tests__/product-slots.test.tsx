// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { PRODUCT_DETAIL_REQUISITES } from 'simplycms/contracts/views';

const toast = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}));

import { SlotHarness, requisite } from './slots-harness';
import { ProductPriceBlock } from '../views/slots/ProductPriceBlock';
import { ProductStockBadge } from '../views/slots/ProductStockBadge';
import { ProductAddToCart } from '../views/slots/ProductAddToCart';
import {
  ProductPluginAfter,
  ProductPluginBadges,
  ProductPluginBefore,
} from '../views/slots/ProductPluginSlots';

/**
 * Юніти реквізитів картки товару (Фаза 2, Step 3): маркер на кореневому
 * елементі + стани, які тема НЕ повинна вміти зламати — доступність
 * купівлі, наявність, ціна зі знижкою.
 */
describe('slot-компоненти картки товару', () => {
  beforeEach(() => {
    localStorage.clear();
    toast.mockClear();
  });
  afterEach(cleanup);

  it('ProductPriceBlock: маркер, ціна й закреслена стара ціна', () => {
    const { container } = render(
      <SlotHarness>
        <ProductPriceBlock price={4200} oldPrice={5000} />
      </SlotHarness>,
    );

    const root = requisite(container, PRODUCT_DETAIL_REQUISITES.PriceBlock);
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain('4');
    expect(root?.querySelectorAll('span')).toHaveLength(2);
  });

  it('ProductPriceBlock: стару ціну нижчу за поточну не показує', () => {
    const { container } = render(
      <SlotHarness>
        <ProductPriceBlock price={4200} oldPrice={4000} />
      </SlotHarness>,
    );

    const root = requisite(container, PRODUCT_DETAIL_REQUISITES.PriceBlock);
    expect(root?.querySelectorAll('span')).toHaveLength(1);
  });

  it.each([
    ['in_stock', 0],
    ['on_order', 1],
    ['out_of_stock', 1],
  ])('ProductStockBadge: маркер є завжди (%s)', (status, badges) => {
    const { container } = render(
      <SlotHarness>
        <ProductStockBadge stockStatus={status} />
      </SlotHarness>,
    );

    const root = requisite(container, PRODUCT_DETAIL_REQUISITES.StockBadge);
    expect(root).not.toBeNull();
    expect(root?.children).toHaveLength(badges);
  });

  it('ProductAddToCart: кладе позицію в кошик і показує toast', () => {
    const { container } = render(
      <SlotHarness>
        <ProductAddToCart
          inStock
          item={{
            productId: 'prod-1',
            modificationId: 'mod-1',
            name: 'Інвертор',
            modificationName: '5 кВт',
            price: 4200,
          }}
        />
      </SlotHarness>,
    );

    const button = requisite(container, PRODUCT_DETAIL_REQUISITES.AddToCart);
    expect(button).not.toBeNull();
    fireEvent.click(button as HTMLElement);

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0].description).toBe('Інвертор (5 кВт)');
    expect(localStorage.getItem('simplycms-cart')).toContain('prod-1');
  });

  it.each([
    ['немає в наявності', false],
    ['ціна невідома', true],
  ])('ProductAddToCart: кнопка вимкнена — %s', (_case, inStock) => {
    const item = inStock
      ? null
      : { productId: 'p', modificationId: null, name: 'X', price: 1 };

    render(
      <SlotHarness>
        <ProductAddToCart inStock={inStock} item={item} />
      </SlotHarness>,
    );

    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('точки розширення плагінів несуть маркер і без жодного плагіна', () => {
    const { container } = render(
      <SlotHarness>
        <ProductPluginBefore context={{}} />
        <ProductPluginBadges context={{}} />
        <ProductPluginAfter context={{}} />
      </SlotHarness>,
    );

    for (const name of [
      PRODUCT_DETAIL_REQUISITES.PluginBefore,
      PRODUCT_DETAIL_REQUISITES.PluginBadges,
      PRODUCT_DETAIL_REQUISITES.PluginAfter,
    ]) {
      expect(requisite(container, name), name).not.toBeNull();
    }
  });
});
