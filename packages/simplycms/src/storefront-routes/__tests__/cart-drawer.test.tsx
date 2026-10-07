// @vitest-environment jsdom
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { CartQuote } from 'simplycms/contracts';
import { useCart } from 'simplycms/react-query';

/**
 * Drawer кошика (Е6в-13): ціни, знижки й підказки — лише з серверної квоти.
 * Квоту дає T5-контейнер (`core/components/cart/CartDrawer`), `cart-ui` її
 * лише показує; підказки рендерить контейнер (`DiscountHints` з catalog-ui).
 */
const quoteState = vi.hoisted(() => ({
  quote: null as CartQuote | null,
}));
vi.mock('simplycms/core/hooks/useCartQuote', () => ({
  useCartQuote: () => ({
    quote: quoteState.quote,
    isLoading: quoteState.quote === null,
  }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

import { CartDrawer } from 'simplycms/core/components/cart/CartDrawer';
import { SlotHarness } from './slots-harness';

const P1 = '10000002-0000-4000-8000-000000000001';
const P2 = '10000002-0000-4000-8000-000000000002';

function Opened() {
  const { setIsOpen } = useCart();
  useEffect(() => setIsOpen(true), [setIsOpen]);
  return <CartDrawer />;
}
const renderDrawer = () =>
  render(
    <SlotHarness>
      <Opened />
    </SlotHarness>,
  );
const digits = (el: Element | null) => el?.textContent?.replace(/\s/g, '');

beforeEach(() => {
  localStorage.setItem(
    'simplycms-cart',
    JSON.stringify([
      { productId: P1, modificationId: null, name: 'Панель', quantity: 2 },
      { productId: P2, modificationId: null, name: 'Зниклий', quantity: 1 },
    ]),
  );
  quoteState.quote = null;
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('CartDrawer: квота кошика', () => {
  it('поки квоти немає — скелети цін і суми, а не 0', () => {
    const { container } = renderDrawer();
    expect(container.textContent).toContain('Панель');
    expect(container.textContent).not.toContain('₴');
    expect(
      container.querySelectorAll('[aria-busy="true"]').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('ціна й закреслена база з квоти, назви знижок, підказка; недоступний рядок', () => {
    quoteState.quote = {
      lines: [
        {
          available: true,
          productId: P1,
          modificationId: null,
          quantity: 2,
          name: 'Панель',
          basePrice: 1000,
          price: 900,
          applied: [{ name: 'Весняна −10%', calculatedAmount: 100 }],
          hints: [
            { kind: 'quantity', threshold: 5, finalPrice: 800, percentOff: 20 },
          ],
        },
        { available: false, productId: P2, modificationId: null, quantity: 1 },
      ],
      subtotal: 1800,
    };
    const { container, getByText } = renderDrawer();
    const text = digits(container);
    expect(text).toContain('1800'); // 900 × 2 і сума кошика
    expect(container.querySelector('.line-through')?.textContent).toMatch(
      /2\s?000/,
    );
    expect(getByText('Весняна −10%')).toBeTruthy();
    expect(container.textContent).toMatch(/від 5 шт/);
    expect(getByText('Товар недоступний')).toBeTruthy();
    // Недоступний рядок у суму не входить: сума — рівно `subtotal` квоти.
    expect(text).not.toContain('2800');
  });
});
