// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CartProvider } from 'simplycms/react-query';
import { useCheckoutQuote } from '../useCheckoutQuote';

/**
 * Рев'ю I2/I3: коли метод/точку/місто ще не обрано, `prepareCheckout`
 * відмовляє ДЕТЕРМІНОВАНО (порожній `shippingMethodId` навіть не пройде
 * `z.string().uuid()` валідатора) — клієнт передбачає це БЕЗ мережі й
 * узагалі не питає. Тести нижче доводять саме відсутність виклику, а не
 * лише прапорець `blocked` (прапорець без доказу «мережі не було» —
 * ослаблений асерт).
 */
const quoteCheckoutMock = vi.fn();
vi.mock('../../../server/checkout-quote', () => ({
  quoteCheckout: (...args: unknown[]) => quoteCheckoutMock(...args),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

const ITEMS = [
  {
    productId: 'p1',
    modificationId: null,
    name: 'Панель',
    price: 100,
    quantity: 1,
  },
];

// Дебаунс 300 мс — чекаємо з запасом, щоб довести, що запит НЕ заплановано,
// а не що він просто ще не встиг спрацювати.
const AFTER_DEBOUNCE_MS = 400;

afterEach(() => {
  cleanup();
  quoteCheckoutMock.mockReset();
});

describe('useCheckoutQuote — blocked не шле запит', () => {
  it('shippingMethodId порожній (порожній довідник, I2) — жодного виклику', async () => {
    const { result } = renderHook(
      () =>
        useCheckoutQuote({
          items: ITEMS,
          shippingMethodId: '',
          pickupPointId: '',
          deliveryCity: '',
          isPickup: false,
          userKey: null,
        }),
      { wrapper },
    );
    expect(result.current.blocked).toBe(true);
    await new Promise((r) => setTimeout(r, AFTER_DEBOUNCE_MS));
    expect(quoteCheckoutMock).not.toHaveBeenCalled();
    expect(result.current.quote).toBeNull();
  });

  it('не-pickup метод без міста (I3) — жодного виклику', async () => {
    const { result } = renderHook(
      () =>
        useCheckoutQuote({
          items: ITEMS,
          shippingMethodId: 'm1',
          pickupPointId: '',
          deliveryCity: '',
          isPickup: false,
          userKey: null,
        }),
      { wrapper },
    );
    expect(result.current.blocked).toBe(true);
    await new Promise((r) => setTimeout(r, AFTER_DEBOUNCE_MS));
    expect(quoteCheckoutMock).not.toHaveBeenCalled();
  });

  it('pickup метод без точки — жодного виклику', async () => {
    const { result } = renderHook(
      () =>
        useCheckoutQuote({
          items: ITEMS,
          shippingMethodId: 'm1',
          pickupPointId: '',
          deliveryCity: '',
          isPickup: true,
          userKey: null,
        }),
      { wrapper },
    );
    expect(result.current.blocked).toBe(true);
    await new Promise((r) => setTimeout(r, AFTER_DEBOUNCE_MS));
    expect(quoteCheckoutMock).not.toHaveBeenCalled();
  });

  it('усе заповнено — НЕ blocked, запит іде', async () => {
    quoteCheckoutMock.mockResolvedValue({
      ok: true,
      quote: { items: [], subtotal: 100, shippingCost: 0, total: 100 },
    });
    const { result } = renderHook(
      () =>
        useCheckoutQuote({
          items: ITEMS,
          shippingMethodId: 'm1',
          pickupPointId: 'pt1',
          deliveryCity: '',
          isPickup: true,
          userKey: null,
        }),
      { wrapper },
    );
    expect(result.current.blocked).toBe(false);
    await waitFor(() => expect(quoteCheckoutMock).toHaveBeenCalledTimes(1));
  });
});
