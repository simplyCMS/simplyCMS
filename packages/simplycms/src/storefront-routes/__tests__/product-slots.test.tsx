// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { PRODUCT_DETAIL_REQUISITES } from 'simplycms/contracts/views';
import {
  MAX_CART_LINES,
  MAX_LINE_QUANTITY,
} from 'simplycms/contracts/cart-limits';

const toast = vi.fn();
const PRODUCT = '10000002-0000-4000-8000-000000000004';
const MOD = '10000003-0000-4000-8000-000000000001';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast }),
}));

import { SlotHarness, requisite } from './slots-harness';
import { ProductPriceBlock } from '../views/slots/ProductPriceBlock';
import type { StockStatus } from 'simplycms/contracts';
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

  // 🔴 `null` тут — негативний контроль ПРАВИЛА, а не крайовий випадок рендеру:
  // саме на ньому слот раніше розходився з доменом (`isPurchasable(null) === true`,
  // а власна формула слота давала «немає в наявності»). DEFAULT колонки —
  // `in_stock`, тож відсутність твердження і є «в наявності»: бейджа немає.
  it.each([
    ['in_stock', 0],
    ['on_order', 1],
    ['out_of_stock', 1],
    [null, 0],
  ] as ReadonlyArray<readonly [StockStatus | null, number]>)(
    'ProductStockBadge: маркер є завжди (%s)',
    (status, badges) => {
      const { container } = render(
        <SlotHarness>
          <ProductStockBadge stockStatus={status} />
        </SlotHarness>,
      );

      const root = requisite(container, PRODUCT_DETAIL_REQUISITES.StockBadge);
      expect(root).not.toBeNull();
      expect(root?.children).toHaveLength(badges);
    },
  );

  it('ProductAddToCart: кладе позицію в кошик і показує toast', () => {
    const { container } = render(
      <SlotHarness>
        <ProductAddToCart
          inStock
          item={{
            productId: PRODUCT,
            modificationId: MOD,
            name: 'Інвертор',
            modificationName: '5 кВт',
          }}
        />
      </SlotHarness>,
    );

    const button = requisite(container, PRODUCT_DETAIL_REQUISITES.AddToCart);
    expect(button).not.toBeNull();
    fireEvent.click(button as HTMLElement);

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0].title).toBe('Додано в кошик');
    expect(toast.mock.calls[0][0].description).toBe('Інвертор (5 кВт)');
    expect(localStorage.getItem('simplycms-cart')).toContain(PRODUCT);
    // Ціни в кошику немає — її рахує серверна квота (Е6в-13).
    expect(localStorage.getItem('simplycms-cart')).not.toContain('price');
  });

  // Е6в-13, ред.3: межу кошика кнопка не обходить мовчки — покупець бачить,
  // чому товар не додався, а не хибне «Додано до кошика».
  it.each([
    [
      `${MAX_CART_LINES}-й рядок уже є`,
      Array.from({ length: MAX_CART_LINES }, (_, i) => ({
        productId: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
        modificationId: null,
        name: `T${i}`,
        quantity: 1,
      })),
    ],
    [
      `${MAX_LINE_QUANTITY} шт цієї позиції`,
      [
        {
          productId: PRODUCT,
          modificationId: MOD,
          name: 'Інвертор',
          quantity: MAX_LINE_QUANTITY,
        },
      ],
    ],
  ])('ProductAddToCart: межа кошика (%s) — тост межі', (_case, stored) => {
    localStorage.setItem('simplycms-cart', JSON.stringify(stored));
    const { container } = render(
      <SlotHarness>
        <ProductAddToCart
          inStock
          item={{ productId: PRODUCT, modificationId: MOD, name: 'Інвертор' }}
        />
      </SlotHarness>,
    );

    fireEvent.click(
      requisite(container, PRODUCT_DETAIL_REQUISITES.AddToCart) as HTMLElement,
    );

    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast.mock.calls[0][0].title).toBe(
      `Досягнуто межу кошика: до ${MAX_CART_LINES} позицій і до ${MAX_LINE_QUANTITY} шт кожної`,
    );
  });

  it.each([
    ['немає в наявності', false],
    ['ціна невідома', true],
  ])('ProductAddToCart: кнопка вимкнена — %s', (_case, inStock) => {
    const item = inStock
      ? null
      : { productId: PRODUCT, modificationId: null, name: 'X' };

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
