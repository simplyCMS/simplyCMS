// @vitest-environment jsdom
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import type { CartQuote } from 'simplycms/contracts';
import { useCart } from 'simplycms/react-query';

/**
 * Drawer кошика (Е6в-13): ціни, знижки й підказки — лише з серверної квоти.
 * Квоту дає T5-контейнер (`core/components/cart/CartDrawer`) через справжній
 * `useCartQuote`; замокано лише serverFn. `cart-ui` квоту лише показує;
 * підказки рендерить контейнер (`DiscountHints` з catalog-ui).
 */
const server = vi.hoisted(() => ({ quoteCart: vi.fn() }));
vi.mock('simplycms/core/lib/cart-quote', () => server);
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
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

/** Квота з доступним рядком (900 × 2) і недоступним; сума — окреме число. */
const QUOTE: CartQuote = {
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
  // Відмінне від кожної суми рядка (1800) — доводить, що підсумок береться
  // саме з `quote.subtotal`, а не складається drawer'ом.
  subtotal: 1750,
};

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
  server.quoteCart.mockReset();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('CartDrawer: квота кошика', () => {
  it('поки квоти немає — скелети цін і суми, а не 0', () => {
    server.quoteCart.mockReturnValue(new Promise(() => {}));
    const { container } = renderDrawer();
    expect(container.textContent).toContain('Панель');
    expect(container.textContent).not.toContain('₴');
    expect(
      container.querySelectorAll('[aria-busy="true"]').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('ціна й закреслена база з квоти, назви знижок, підказка; недоступний рядок', async () => {
    server.quoteCart.mockResolvedValue(QUOTE);
    const { container, findByText, getByText } = renderDrawer();
    await findByText('Товар недоступний');
    const text = digits(container);
    expect(text).toContain('1800'); // рядок: 900 × 2
    expect(text).toContain('1750'); // підсумок: `quote.subtotal`
    expect(container.querySelector('.line-through')?.textContent).toMatch(
      /2\s?000/,
    );
    expect(getByText('Весняна −10%')).toBeTruthy();
    expect(container.textContent).toMatch(/від 5 шт/);
  });

  // R3: недоступна позиція блокує оформлення — сервер однаково відмовив би
  // `not_purchasable`, а покупець має знати, що прибрати.
  it('недоступна позиція блокує «Оформити»; після видалення — знову можна', async () => {
    server.quoteCart.mockResolvedValue(QUOTE);
    const { findByText, getAllByLabelText, getByRole, queryByText } =
      renderDrawer();
    await findByText('Товар недоступний');
    const checkout = getByRole('button', { name: 'Оформити замовлення' });
    expect((checkout as HTMLButtonElement).disabled).toBe(true);
    expect(
      queryByText('Приберіть недоступні товари, щоб оформити замовлення'),
    ).not.toBeNull();

    fireEvent.click(getAllByLabelText('Видалити з кошика')[1]);
    await waitFor(() =>
      expect(
        getByRole('link', { name: 'Оформити замовлення' }).getAttribute('href'),
      ).toBe('/checkout'),
    );
    expect(
      queryByText('Приберіть недоступні товари, щоб оформити замовлення'),
    ).toBeNull();
  });

  // R2: збій квоти — видимий стан помилки з повтором, а не вічний скелет.
  it('збій квоти — «ціну не вдалося отримати» і «Повторити» кличе serverFn знову', async () => {
    server.quoteCart.mockRejectedValue(new Error('500'));
    const { findByText, getByRole, container } = renderDrawer();
    await findByText('Ціну не вдалося отримати');
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();

    server.quoteCart.mockResolvedValue(QUOTE);
    fireEvent.click(getByRole('button', { name: 'Повторити' }));
    await findByText('Товар недоступний');
    expect(server.quoteCart).toHaveBeenCalledTimes(2);
    expect(digits(container)).toContain('1750');
  });
});
