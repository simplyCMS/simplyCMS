// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from 'simplycms/i18n';
import { CheckoutPaymentForm } from '../CheckoutPaymentForm';

afterEach(cleanup);

describe('CheckoutPaymentForm', () => {
  // Е6а-3: до К5 онлайн-оплата нічого не робить — опції немає зовсім.
  it('показує рівно одну опцію — накладений платіж cash', () => {
    render(
      <I18nProvider locale="uk">
        <CheckoutPaymentForm selectedMethod="cash" onMethodChange={vi.fn()} />
      </I18nProvider>,
    );
    const radios = screen.getAllByRole('radio', { hidden: true });
    expect(radios).toHaveLength(1);
    expect((radios[0] as HTMLInputElement).value).toBe('cash');
    expect(screen.queryByText('Онлайн оплата')).toBeNull();
  });
});
