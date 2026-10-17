// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';

/**
 * Задача 14в: `form.watch()` замінено на `useWatch`. Тест доводить, що
 * залежні від значень секції Checkout перемальовуються після `setValue`, як і
 * раніше. Дочірні секції підмінено заглушками, що показують отримані
 * `values`/`notes`/`selectedMethod` і викликають `onChange`, — перевіряється
 * саме проводка сторінки, а не самі секції (їх тримають свої тести).
 */
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock('simplycms/core/hooks/useCart', () => ({
  useCart: () => ({
    items: [{ productId: 'p1', quantity: 1 }],
    clearCart: vi.fn(),
    hydrated: true,
  }),
}));
vi.mock('simplycms/core/hooks/useAuth', () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock('simplycms/themes/store-profile', () => ({
  useStoreProfile: () => ({ contacts: {} }),
}));
vi.mock('../../server/profile', () => ({ getProfileSettings: vi.fn() }));
vi.mock('../../server/checkout', () => ({ placeOrder: vi.fn() }));
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
  CheckoutContactForm: ({
    values,
    onChange,
  }: {
    values: Record<string, string>;
    onChange: OnChange;
  }) => (
    <div>
      <output data-testid="contact-first">{values.firstName}</output>
      <button onClick={() => onChange('firstName', 'Олена')}>set-first</button>
    </div>
  ),
  CheckoutRecipientForm: ({ values }: { values: Record<string, unknown> }) => (
    <output data-testid="recipient-first">{String(values.firstName)}</output>
  ),
  CheckoutDeliveryForm: ({
    values,
    onChange,
  }: {
    values: Record<string, unknown>;
    onChange: OnChange;
  }) => (
    <div>
      <output data-testid="delivery-city">{String(values.deliveryCity)}</output>
      <button onClick={() => onChange('deliveryCity', 'Київ')}>set-city</button>
    </div>
  ),
  CheckoutPaymentForm: ({ selectedMethod }: { selectedMethod: string }) => (
    <output data-testid="payment">{selectedMethod}</output>
  ),
  CheckoutOrderSummary: ({
    notes,
    onNotesChange,
  }: {
    notes: string;
    onNotesChange: (v: string) => void;
  }) => (
    <div>
      <output data-testid="notes">{notes}</output>
      <button onClick={() => onNotesChange('Подзвоніть')}>set-notes</button>
    </div>
  ),
}));

import Checkout from '../Checkout';

afterEach(cleanup);

describe('Checkout: залежні секції після useWatch', () => {
  it('setValue з однієї секції перемальовує інші (контакти, доставка, нотатки, оплата)', () => {
    render(
      <I18nProvider locale="uk">
        <Checkout />
      </I18nProvider>,
    );
    expect(screen.getByTestId('payment').textContent).toBe('cash');
    expect(screen.getByTestId('contact-first').textContent).toBe('');

    fireEvent.click(screen.getByText('set-first'));
    expect(screen.getByTestId('contact-first').textContent).toBe('Олена');
    // Ті самі значення форми приходять у секцію одержувача.
    expect(screen.getByTestId('recipient-first').textContent).toBe('Олена');

    fireEvent.click(screen.getByText('set-city'));
    expect(screen.getByTestId('delivery-city').textContent).toBe('Київ');

    fireEvent.click(screen.getByText('set-notes'));
    expect(screen.getByTestId('notes').textContent).toBe('Подзвоніть');
  });
});
