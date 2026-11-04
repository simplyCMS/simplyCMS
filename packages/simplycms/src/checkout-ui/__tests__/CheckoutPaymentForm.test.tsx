// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CheckoutPaymentForm } from '../CheckoutPaymentForm';
import { TestI18nProvider } from '../../../test-harness/i18n';

afterEach(cleanup);

describe('CheckoutPaymentForm', () => {
  // Е6а-3: до К5 онлайн-оплата нічого не робить — опції немає зовсім.
  it('показує рівно одну опцію — накладений платіж cash', () => {
    render(
      <TestI18nProvider>
        <CheckoutPaymentForm selectedMethod="cash" onMethodChange={vi.fn()} />
      </TestI18nProvider>,
    );
    const radios = screen.getAllByRole('radio', { hidden: true });
    expect(radios).toHaveLength(1);
    expect((radios[0] as HTMLInputElement).value).toBe('cash');
    expect(screen.queryByText('Онлайн оплата')).toBeNull();
  });
});
