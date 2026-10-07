// @vitest-environment jsdom
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { CART_REQUISITES } from 'simplycms/contracts/views';

type LinkMockProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  to: string;
  params?: unknown;
};

// Мок роутера прокидає решту пропсів на <a> — інакше маркер реквізиту,
// який `asChild` зливає в дочірній лінк, губився б у самому моці.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params: _params, ...rest }: LinkMockProps) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}));

// Квота кошика — керована з тесту: сума підсумку береться ЛИШЕ з неї.
const quoteState = vi.hoisted(() => ({
  quote: null as { lines: unknown[]; subtotal: number } | null,
}));
vi.mock('simplycms/core/hooks/useCartQuote', () => ({
  useCartQuote: () => ({
    quote: quoteState.quote,
    isLoading: quoteState.quote === null,
  }),
}));

import { SlotHarness, requisite } from './slots-harness';
import {
  CartCheckoutButton,
  CartClearButton,
  CartItemsList,
} from '../views/slots/CartSlots';
import { CartSummary } from '../views/slots/CartSummary';

const storedCart = [
  {
    productId: '10000002-0000-4000-8000-000000000004',
    modificationId: '10000003-0000-4000-8000-000000000001',
    name: 'Item A',
    quantity: 2,
  },
  {
    productId: '10000002-0000-4000-8000-000000000001',
    modificationId: null,
    name: 'Item B',
    quantity: 1,
  },
];

/**
 * Юніти реквізитів кошика (Фаза 2, Step 3). Кошик — справжній
 * (`CartProvider` на localStorage), тому це заразом доказ, що логіка
 * переїхала в слоти без втрат: сума, очищення й перехід до оформлення.
 */
describe('slot-компоненти кошика', () => {
  beforeEach(() => {
    localStorage.setItem('simplycms-cart', JSON.stringify(storedCart));
    quoteState.quote = { lines: [], subtotal: 2300 };
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('CartItemsList: маркер і по одній позиції на товар', () => {
    const { container } = render(
      <SlotHarness>
        <CartItemsList />
      </SlotHarness>,
    );

    const root = requisite(container, CART_REQUISITES.Items);
    expect(root).not.toBeNull();
    expect(root?.children).toHaveLength(2);
  });

  it('CartItemsList: порожній кошик — маркер лишається', () => {
    localStorage.setItem('simplycms-cart', '[]');

    const { container } = render(
      <SlotHarness>
        <CartItemsList />
      </SlotHarness>,
    );

    const root = requisite(container, CART_REQUISITES.Items);
    expect(root).not.toBeNull();
    expect(root?.children).toHaveLength(0);
  });

  it('CartSummary: маркер і сума з квоти кошика', () => {
    const { container } = render(
      <SlotHarness>
        <CartSummary />
      </SlotHarness>,
    );

    const root = requisite(container, CART_REQUISITES.Summary);
    expect(root).not.toBeNull();
    // `subtotal` квоти; формат бере локаль і валюту з EngineContext
    expect(root?.textContent?.replace(/\s/g, '')).toContain('2300');
  });

  it('CartSummary: до першої квоти — скелет суми, а не 0', () => {
    quoteState.quote = null;
    const { container } = render(
      <SlotHarness>
        <CartSummary />
      </SlotHarness>,
    );

    const root = requisite(container, CART_REQUISITES.Summary);
    expect(root?.textContent).not.toContain('₴');
    expect(root?.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('CartClearButton: маркер і очищення кошика', () => {
    const { container } = render(
      <SlotHarness>
        <CartClearButton />
        <CartItemsList />
      </SlotHarness>,
    );

    const button = requisite(container, CART_REQUISITES.ClearCart);
    expect(button).not.toBeNull();
    fireEvent.click(button as HTMLElement);

    expect(requisite(container, CART_REQUISITES.Items)?.children).toHaveLength(
      0,
    );
  });

  it('CartCheckoutButton: маркер і перехід на /checkout', () => {
    const { container } = render(
      <SlotHarness>
        <CartCheckoutButton />
      </SlotHarness>,
    );

    const link = requisite(container, CART_REQUISITES.Checkout);
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/checkout');
  });
});
