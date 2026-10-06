// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import { OrderTotals } from '../OrderTotals';

afterEach(cleanup);

const snapshot = (pricing: string) => ({
  methodName: 'Нова Пошта',
  provider: 'core:address',
  pricing,
  destination: { kind: 'address', city: 'Львів', address: 'вул. 5' },
});

const renderTotals = (shippingData: unknown, shippingCost = '0.00') =>
  render(
    <EngineProvider value={ENGINE}>
      <I18nProvider locale="uk">
        <OrderTotals
          subtotal="100.00"
          shippingCost={shippingCost}
          total="100.00"
          shippingData={shippingData as never}
        />
      </I18nProvider>
    </EngineProvider>,
  );

/** Значення рядка «Доставка» — сусід підпису в тому самому рядку. */
const shippingValue = () =>
  screen.getByText('Доставка').nextElementSibling?.textContent;

describe('OrderTotals — рядок доставки (Е6а-4)', () => {
  it('carrier: підпис режиму замість суми', () => {
    renderTotals(snapshot('carrier'));
    expect(shippingValue()).toBe('За тарифами перевізника');
  });

  it('rates і невалідний знімок: доставка числом', () => {
    renderTotals(snapshot('rates'), '70.00');
    expect(shippingValue()).toMatch(/^70\s₴$/);
    cleanup();
    renderTotals({}, '0.00');
    expect(shippingValue()).toMatch(/^0\s₴$/);
  });
});
