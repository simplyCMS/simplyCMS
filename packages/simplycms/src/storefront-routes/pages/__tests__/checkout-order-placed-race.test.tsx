// @vitest-environment jsdom
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';

/**
 * Гонка Task 14: після успішного замовлення `clearCart()` спорожнює кошик ще
 * на сторінці чекауту, і ефект «порожній кошик -> /cart» не повинен
 * перехопити навігацію на `/order-success`. Гвард — стан `orderPlaced`,
 * виставлений через `flushSync` ПЕРЕД `clearCart()`.
 *
 * Кошик підмінено справжнім за формою сховищем на `useSyncExternalStore`
 * (як `CartProvider`): спорожнення приходить синхронним оновленням стору.
 *
 * Межа доказу: тест ловить мутацію «прапорець не виставляється». Мутації
 * «без flushSync» і «прапорець ПІСЛЯ clearCart» на React 19 зелені за
 * побудовою: sync-лейни обʼєднані, а `flushSync` одразу зливає і прапорець,
 * і спорожнення кошика в один рендер. `flushSync` лишається для peer React 18.
 */
const cart = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let items: { productId: string; quantity: number }[] = [
    { productId: 'p1', quantity: 1 },
  ];
  return {
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    get: () => items,
    clear: () => {
      items = [];
      listeners.forEach((cb) => cb());
    },
    reset: () => {
      items = [{ productId: 'p1', quantity: 1 }];
    },
  };
});
const nav = vi.hoisted(() => vi.fn());
const place = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => nav,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('simplycms/core/hooks/useCart', () => ({
  useCart: () => ({
    items: useSyncExternalStore(cart.subscribe, cart.get, cart.get),
    clearCart: cart.clear,
    hydrated: true,
  }),
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('simplycms/themes/store-profile', () => ({
  useStoreProfile: () => ({ contacts: {} }),
}));
vi.mock('simplycms/core/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('../../server/profile', () => ({ getProfileSettings: vi.fn() }));
vi.mock('../../server/checkout', () => ({ placeOrder: place }));
vi.mock('simplycms/plugins/PluginSlot', () => ({ PluginSlot: () => null }));
vi.mock('simplycms/cart-ui', () => ({ QuoteFailure: () => null }));
vi.mock('../checkout/build-quote-input', () => ({
  toCheckoutItems: () => [],
}));
vi.mock('../checkout/useCheckoutQuote', () => ({
  useCheckoutQuote: () => ({
    quote: null,
    quoting: false,
    matchesCurrent: false,
    blocked: false,
    failed: false,
  }),
}));
vi.mock('../checkout/useIndicativeSubtotal', () => ({
  useIndicativeSubtotal: () => ({
    subtotal: null,
    failed: false,
    retry: vi.fn(),
  }),
}));

type OnChange = (field: string, value: string) => void;
vi.mock('simplycms/checkout-ui', () => ({
  REJECTION_KEY: {},
  CheckoutAuthBlock: () => null,
  CheckoutRecipientForm: () => null,
  CheckoutPaymentForm: () => null,
  CheckoutContactForm: ({ onChange }: { onChange: OnChange }) => (
    <button
      type="button"
      onClick={() => {
        onChange('firstName', 'Олена');
        onChange('lastName', 'Коваль');
        onChange('phone', '0501234567');
        onChange('shippingMethodId', 'm1');
      }}
    >
      fill
    </button>
  ),
  CheckoutDeliveryForm: () => null,
  CheckoutOrderSummary: () => <button type="submit">submit</button>,
}));

import Checkout from '../Checkout';

afterEach(() => {
  cleanup();
  cart.reset();
  nav.mockReset();
  place.mockReset();
});

describe('Checkout: гонка clearCart після оформлення', () => {
  it('після успіху навігація лише на /order-success, без редиректу на /cart', async () => {
    place.mockResolvedValue({
      ok: true,
      order: { id: 'o1', orderNumber: 7, accessToken: 'tok' },
    });
    render(
      <I18nProvider locale="uk">
        <Checkout />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByText('fill'));
    fireEvent.click(screen.getByText('submit'));

    await waitFor(() =>
      expect(nav.mock.calls.map((c) => c[0].to)).toContain(
        '/order-success/$orderId',
      ),
    );
    // Редирект ефекту порожнього кошика, якби гвард не спрацював, прийшов би
    // у цей проміжок.
    await new Promise((r) => setTimeout(r, 50));
    expect(nav.mock.calls.map((c) => c[0].to)).toEqual([
      '/order-success/$orderId',
    ]);
    expect(cart.get()).toEqual([]);
  });
});
