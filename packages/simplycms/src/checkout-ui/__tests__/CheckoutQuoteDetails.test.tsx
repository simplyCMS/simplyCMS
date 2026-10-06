// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CheckoutQuote } from 'simplycms/contracts';

vi.mock('simplycms/react-query', async (orig) => ({
  ...(await orig()),
  useEngine: () => ({ config: { locale: 'uk-UA', currency: 'UAH' } }),
  useFormatPrice: () => (n: number) => `${n} грн`,
}));

import { I18nProvider } from 'simplycms/i18n';
import { CheckoutQuoteDetails } from '../CheckoutQuoteDetails';

const quote = (over: Partial<CheckoutQuote>): CheckoutQuote => ({
  items: [],
  subtotal: 100,
  shippingCost: 0,
  shippingPricing: 'rates',
  total: 100,
  ...over,
});

const renderQuote = (q: CheckoutQuote) =>
  render(
    <I18nProvider locale="uk">
      <CheckoutQuoteDetails quote={q} />
    </I18nProvider>,
  );

afterEach(cleanup);

describe('CheckoutQuoteDetails — доставка', () => {
  // Е6а-18: нуль у режимі carrier — не «Безкоштовно».
  it('carrier з нульовою сумою: «За тарифами перевізника»', () => {
    renderQuote(quote({ shippingPricing: 'carrier' }));
    expect(screen.getByText('За тарифами перевізника')).toBeTruthy();
    expect(screen.queryByText('Безкоштовно')).toBeNull();
  });

  it('rates з нулем лишається «Безкоштовно»', () => {
    renderQuote(quote({}));
    expect(screen.getByText('Безкоштовно')).toBeTruthy();
  });
});
