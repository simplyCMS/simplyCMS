// @vitest-environment jsdom
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { CartQuote } from 'simplycms/contracts';
import type { ProductImageViewModel } from 'simplycms/contracts/views';
import { useCart } from 'simplycms/react-query';

/**
 * М1 Task 17б fix-1 (I2): мініатюра кошика — мовою СТОРІНКИ, з квоти (той самий читач фото, що
 * сторінка товару). Кеш фото в localStorage живе під тією самою міткою `namesLocale`, що назви
 * (Task 16): до квоти показується лише на сторінці тієї ж мови, інакше скелетон; після квоти
 * кеш оновлюється фото квоти.
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
const UK_IMAGE = { url: '/media/main.png', alt: 'Кабель спереду' };
const EN_IMAGE = { url: '/media/main-en.png', alt: 'Cable front' };

const quote = (image: ProductImageViewModel | null): CartQuote => ({
  lines: [
    {
      available: true,
      productId: P,
      modificationId: null,
      quantity: 1,
      name: 'Cable',
      productName: 'Cable',
      modificationName: null,
      productNameLang: null,
      modificationNameLang: null,
      image,
      basePrice: 100,
      price: 100,
      applied: [],
      hints: [],
    },
  ],
  subtotal: 100,
});

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
    image?: ProductImageViewModel;
    namesLocale?: string;
  }[];
const img = (c: HTMLElement) => c.querySelector('img');
const skeleton = (c: HTMLElement) =>
  c.querySelector('[data-testid="cart-item-image-skeleton"]');

beforeEach(() => {
  // Товар додали на основній мові (`/`): фото й назва — з міткою `uk`.
  localStorage.setItem(
    'simplycms-cart',
    JSON.stringify([
      {
        productId: P,
        modificationId: null,
        name: 'Кабель',
        namesLocale: 'uk',
        image: UK_IMAGE,
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

describe('мініатюра кошика мовою сторінки', () => {
  it('додано на /, відкрито /en/cart: до квоти — скелетон, а не фото uk; після — перевизначене фото en', async () => {
    let resolve!: (q: CartQuote) => void;
    server.quoteCart.mockReturnValue(
      new Promise<CartQuote>((r) => (resolve = r)),
    );
    const { container } = renderAt('en');
    expect(img(container)).toBeNull();
    expect(skeleton(container)).not.toBeNull();

    resolve(quote(EN_IMAGE));
    await waitFor(() =>
      expect(img(container)?.getAttribute('src')).toBe(EN_IMAGE.url),
    );
    expect(img(container)?.getAttribute('alt')).toBe('Cable front');
    expect(img(container)?.hasAttribute('lang')).toBe(false);
    // Кеш оновлено фото квоти під міткою мови квоти.
    await waitFor(() => expect(stored()[0]?.namesLocale).toBe('en'));
    expect(stored()[0]?.image).toMatchObject(EN_IMAGE);
  });

  it('на / кеш тієї ж мови — одразу, без скелета', () => {
    server.quoteCart.mockReturnValue(new Promise(() => {}));
    const { container } = renderAt('uk');
    expect(img(container)?.getAttribute('src')).toBe(UK_IMAGE.url);
    expect(img(container)?.getAttribute('alt')).toBe(UK_IMAGE.alt);
    expect(skeleton(container)).toBeNull();
  });

  it('fallback alt квоти — з lang основної на самому <img>', async () => {
    server.quoteCart.mockResolvedValue(
      quote({ url: '/media/back.png', alt: 'Кабель ззаду', alt_lang: 'uk' }),
    );
    const { container } = renderAt('en');
    await waitFor(() =>
      expect(img(container)?.getAttribute('src')).toBe('/media/back.png'),
    );
    expect(img(container)?.getAttribute('lang')).toBe('uk');
  });

  it('квота без фото — заглушка, кешоване фото іншої мови прибрано', async () => {
    server.quoteCart.mockResolvedValue(quote(null));
    const { container, findByText } = renderAt('en');
    await findByText('Cable');
    expect(img(container)).toBeNull();
    expect(skeleton(container)).toBeNull();
    await waitFor(() => expect(stored()[0]?.namesLocale).toBe('en'));
    expect(stored()[0]?.image).toBeUndefined();
  });

  it('квота впала: кеш іншої мови — з lang мови, у якій його збережено', async () => {
    server.quoteCart.mockRejectedValue(new Error('network'));
    const { container } = renderAt('en');
    await waitFor(() =>
      expect(img(container)?.getAttribute('src')).toBe(UK_IMAGE.url),
    );
    expect(img(container)?.getAttribute('lang')).toBe('uk');
  });

  it('старий формат кешу (рядок URL) відкидається, а не показується', () => {
    localStorage.setItem(
      'simplycms-cart',
      JSON.stringify([
        {
          productId: P,
          modificationId: null,
          name: 'Кабель',
          namesLocale: 'uk',
          image: '/media/old.png',
          quantity: 1,
        },
      ]),
    );
    server.quoteCart.mockReturnValue(new Promise(() => {}));
    const { container } = renderAt('uk');
    expect(img(container)).toBeNull();
  });
});
