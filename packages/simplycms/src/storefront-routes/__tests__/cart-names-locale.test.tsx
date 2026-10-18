// @vitest-environment jsdom
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { CartQuote } from 'simplycms/contracts';
import { useCart } from 'simplycms/react-query';

/**
 * М1 Task 16 (I4): видимий кошик показує назви мовою СТОРІНКИ, а не мовою, якою товар додали.
 * Кеш назв у localStorage несе `namesLocale`: до приходу квоти він показується лише на сторінці
 * тієї ж мови (інакше скелетон), після квоти назви — з квоти, і кеш оновлюється її мовою.
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

const P = '10000002-0000-4000-8000-000000000001';
const M = '10000003-0000-4000-8000-000000000001';

/** Квота англійською: товар перекладено, модифікація — fallback основної мови. */
const QUOTE_EN: CartQuote = {
  lines: [
    {
      available: true,
      productId: P,
      modificationId: M,
      quantity: 1,
      name: 'Cable - Синій',
      productName: 'Cable',
      modificationName: 'Синій',
      productNameLang: null,
      modificationNameLang: 'uk',
      image: null,
      basePrice: 100,
      price: 100,
      applied: [],
      hints: [],
    },
  ],
  subtotal: 100,
};

function Opened() {
  const { setIsOpen } = useCart();
  useEffect(() => setIsOpen(true), [setIsOpen]);
  return <CartDrawer />;
}
const renderAt = (locale: string) =>
  render(
    <SlotHarness locale={locale}>
      <Opened />
    </SlotHarness>,
  );
const stored = () =>
  JSON.parse(localStorage.getItem('simplycms-cart') ?? '[]') as {
    name: string;
    modificationName?: string;
    namesLocale?: string;
  }[];

beforeEach(() => {
  // Товар додали на основній мові (`/`): назви українські, мітка `uk`.
  localStorage.setItem(
    'simplycms-cart',
    JSON.stringify([
      {
        productId: P,
        modificationId: M,
        name: 'Кабель',
        modificationName: 'Синій',
        namesLocale: 'uk',
        quantity: 1,
      },
    ]),
  );
  server.quoteCart.mockReset();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('кошик на /en: назви мовою сторінки', () => {
  it('перший кадр без uk-назв (скелетон), після квоти — en; fallback-частина має lang основної', async () => {
    let resolve!: (q: CartQuote) => void;
    server.quoteCart.mockReturnValue(
      new Promise<CartQuote>((r) => (resolve = r)),
    );
    const { container, findByText } = renderAt('en');

    expect(container.textContent).not.toContain('Кабель');
    expect(container.textContent).not.toContain('Синій');
    expect(
      container.querySelector('[data-testid="cart-item-names-skeleton"]'),
    ).not.toBeNull();

    resolve(QUOTE_EN);
    await findByText('Cable');
    expect(container.textContent).not.toContain('Кабель');
    expect(
      container.querySelector('h4 [lang]'),
      'перекладена назва без lang',
    ).toBeNull();
    expect(
      (await findByText('Синій')).closest('[lang]')?.getAttribute('lang'),
    ).toBe('uk');
  });

  it('після квоти кеш оновлюється назвами й мовою квоти; повторне відкриття /en/cart — en одразу', async () => {
    server.quoteCart.mockResolvedValue(QUOTE_EN);
    const first = renderAt('en');
    await first.findByText('Cable');
    await waitFor(() => expect(stored()[0]?.namesLocale).toBe('en'));
    expect(stored()[0]).toMatchObject({ name: 'Cable', namesLocale: 'en' });
    first.unmount();

    // Нове відкриття: квота ще в дорозі, кеш уже англійський — без скелета.
    server.quoteCart.mockReturnValue(new Promise(() => {}));
    const again = renderAt('en');
    expect(again.container.textContent).toContain('Cable');
    expect(
      again.container.querySelector('[data-testid="cart-item-names-skeleton"]'),
    ).toBeNull();
  });

  it('на основній мові кеш тієї ж мови показується одразу, без скелета', () => {
    server.quoteCart.mockReturnValue(new Promise(() => {}));
    const { container } = renderAt('uk');
    expect(container.textContent).toContain('Кабель');
    expect(
      container.querySelector('[data-testid="cart-item-names-skeleton"]'),
    ).toBeNull();
  });

  it('квота впала: кеш іншої мови показується з lang мови, у якій його отримано', async () => {
    server.quoteCart.mockRejectedValue(new Error('network'));
    const { findByText } = renderAt('en');
    const name = await findByText('Кабель');
    expect(name.closest('[lang]')?.getAttribute('lang')).toBe('uk');
  });
});
