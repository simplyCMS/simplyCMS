// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// `useFormatPrice` замінено ЦІЛКОМ (не через `useEngine`): реальна реалізація
// кличе `useEngine` ВІДНОСНИМ імпортом усередині `simplycms/react-query`, тож
// мок самого лише `useEngine` цей виклик не перехопить (окремий шлях
// резолву модуля) — простіше й чесніше замінити форматер напряму.
vi.mock('simplycms/react-query', async (orig) => ({
  ...(await orig()),
  useEngine: () => ({ config: { locale: 'uk-UA', currency: 'UAH' } }),
  useFormatPrice: () => (value: number) => `${value}₴`,
}));

import type { QuoteCheckoutResult } from 'simplycms/contracts';
import { I18nProvider } from 'simplycms/i18n';
import { CheckoutOrderSummary } from '../CheckoutOrderSummary';

const QUOTE: QuoteCheckoutResult = {
  ok: true,
  quote: {
    items: [
      {
        productId: 'p1',
        modificationId: null,
        name: 'Панель',
        price: 100,
        basePrice: null,
        quantity: 2,
      },
    ],
    subtotal: 200,
    shippingCost: 50,
    total: 250,
  },
};

const renderSummary = (
  quote: QuoteCheckoutResult | null,
  extra: Record<string, unknown> = {},
) =>
  render(
    <I18nProvider locale="uk">
      <CheckoutOrderSummary
        quote={quote}
        quoting={false}
        matchesCurrent={true}
        blocked={false}
        notes=""
        onNotesChange={vi.fn()}
        isSubmitting={false}
        canSubmit={quote?.ok === true}
        {...extra}
      />
    </I18nProvider>,
  );

// `getByRole` — jest-dom не підключений у проєкті (див. avatar-upload-disabled
// .test.tsx), тож перевіряємо властивість `disabled` напряму, не матчером.
const submitButton = () =>
  screen.getByRole('button', {
    name: /Підтвердити замовлення/,
  }) as HTMLButtonElement;

afterEach(() => cleanup());

describe('CheckoutOrderSummary', () => {
  it('без квоти — скелет, submit disabled', () => {
    const { container } = renderSummary(null);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      0,
    );
    expect(submitButton().disabled).toBe(true);
  });

  it('відмова квоти — текст із REJECTION_KEY, submit disabled', () => {
    renderSummary({ ok: false, reason: 'not_purchasable' });
    screen.getByText(
      'Частина товарів у кошику зараз недоступна — перевірте кошик',
    );
    expect(submitButton().disabled).toBe(true);
  });

  it('з квотою — числа саме з неї, submit активний', () => {
    renderSummary(QUOTE);
    expect(document.getElementById('checkout-total')?.textContent).toBe('250₴');
    expect(submitButton().disabled).toBe(false);
  });

  // Рев'ю I2/I3: довідник порожній АБО не-pickup без міста — раніше це
  // давало вічний скелет або хибну червону відмову. `blocked` — окремий
  // нейтральний стан: ні скелет, ні REJECTION_KEY.
  it('заблоковано (немає методу/точки/міста) — НЕ скелет і НЕ відмова', () => {
    const { container } = renderSummary(null, { blocked: true });
    expect(container.querySelectorAll('.animate-pulse').length).toBe(0);
    screen.getByText('Заповніть дані доставки, щоб побачити суму замовлення');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(submitButton().disabled).toBe(true);
  });

  // Рев'ю #6: у вікні дебаунсу `quotedKey !== key` (matchesCurrent: false) —
  // підсумок не має показувати числа ПОПЕРЕДНЬОЇ квоти як актуальні.
  it('квота застаріла (matchesCurrent: false) — скелет, а не старі числа', () => {
    const { container } = renderSummary(QUOTE, { matchesCurrent: false });
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(
      0,
    );
    expect(document.getElementById('checkout-total')).toBeNull();
  });
});
