// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CartQuote, QuoteCheckoutResult } from 'simplycms/contracts';
import { I18nProvider } from 'simplycms/i18n';

/**
 * Сума, від якої список способів доставки рахує тарифи ДО вибору способу
 * (Е6в-13, ред.5): квота кошика, після успішної квоти оформлення — її
 * `subtotal`; до першої квоти кошика — стан завантаження, а не тариф від 0.
 *
 * 🔴 Довідник і `resolveShippingRate` — справжні: тест доводить, що сума з
 * квоти доходить до того самого доменного правила, яке рахує сервер.
 */
const cartQuote = vi.hoisted(() => ({ quote: null as CartQuote | null }));
vi.mock('simplycms/core/hooks/useCartQuote', () => ({
  useCartQuote: () => ({
    quote: cartQuote.quote,
    isLoading: cartQuote.quote === null,
  }),
}));
vi.mock('simplycms/core/lib/shipping-directory', () => ({
  getShippingDirectory: async () => ({
    methods: [
      {
        id: 'm1',
        code: 'courier',
        name: 'Курʼєр',
        description: null,
        icon: null,
        provider: 'core:address',
        pricing: 'rates',
        is_active: true,
        sort_order: 0,
        created_at: new Date(0),
        updated_at: new Date(0),
      },
    ],
    zones: [],
    rates: [
      {
        id: 'r1',
        method_id: 'm1',
        zone_id: 'z1',
        name: 'Безкоштовно від 5000',
        calculation_type: 'free_from',
        base_cost: 150,
        per_kg_cost: null,
        min_weight: null,
        free_from_amount: 5000,
        min_order_amount: null,
        max_order_amount: null,
        estimated_days: null,
        is_active: true,
        sort_order: 0,
        config: {},
        created_at: new Date(0),
      },
    ],
    pickupPoints: [],
  }),
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('simplycms/core/hooks/useAddressBook', () => ({
  useAddressBook: () => ({ addresses: [], save: vi.fn() }),
}));

import { CheckoutDeliveryForm } from 'simplycms/checkout-ui';
import { TestEngineProvider } from '../../../__tests__/engine-stub';
import { useIndicativeSubtotal } from '../useIndicativeSubtotal';

function Probe({ checkout }: { checkout: QuoteCheckoutResult | null }) {
  const subtotal = useIndicativeSubtotal(checkout);
  return (
    <CheckoutDeliveryForm values={{}} onChange={() => {}} subtotal={subtotal} />
  );
}
const renderProbe = (checkout: QuoteCheckoutResult | null = null) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nProvider locale="uk">
        <TestEngineProvider>
          <Probe checkout={checkout} />
        </TestEngineProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  cartQuote.quote = null;
});
afterEach(cleanup);

describe('сума тарифів до вибору способу доставки', () => {
  it('кошик на 6000 за квотою → «Безкоштовно» ще до вибору способу', async () => {
    cartQuote.quote = { lines: [], subtotal: 6000 };
    renderProbe();
    expect(await screen.findByText('Безкоштовно')).toBeTruthy();
  });

  it('квоти кошика ще немає — стан завантаження тарифу, а не тариф від 0', async () => {
    const { container } = renderProbe();
    await screen.findByText('Курʼєр');
    expect(screen.queryByText('Безкоштовно')).toBeNull();
    expect(container.textContent).not.toContain('₴');
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it('успішна квота оформлення має перевагу над квотою кошика', async () => {
    cartQuote.quote = { lines: [], subtotal: 6000 };
    const { container } = renderProbe({
      ok: true,
      quote: {
        items: [],
        subtotal: 3000,
        shippingCost: 150,
        shippingPricing: 'rates',
        total: 3150,
      },
    });
    await screen.findByText('Курʼєр');
    await waitFor(() =>
      expect(container.textContent?.replace(/\s/g, '')).toContain('150'),
    );
    expect(screen.queryByText('Безкоштовно')).toBeNull();
  });
});
