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

import { SlotHarness, requisite } from './slots-harness';
import {
  CartCheckoutButton,
  CartClearButton,
  CartItemsList,
} from '../views/slots/CartSlots';
import { CartSummary } from '../views/slots/CartSummary';

const storedCart = [
  {
    productId: 'prod-1',
    modificationId: 'mod-1',
    name: 'Item A',
    price: 1000,
    quantity: 2,
  },
  {
    productId: 'prod-2',
    modificationId: null,
    name: 'Item B',
    price: 500,
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

  it('CartSummary: маркер і сума позицій', () => {
    const { container } = render(
      <SlotHarness>
        <CartSummary />
      </SlotHarness>,
    );

    const root = requisite(container, CART_REQUISITES.Summary);
    expect(root).not.toBeNull();
    // 1000 × 2 + 500 = 2500; формат бере локаль і валюту з EngineContext
    expect(root?.textContent?.replace(/\s/g, '')).toContain('2500');
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
