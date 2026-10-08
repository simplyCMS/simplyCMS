// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { makeOrder } from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { OrderDeliveryCard } from '../OrderDeliveryCard';

afterEach(cleanup);

describe('OrderDeliveryCard — знеособлена адреса (Е6г-7)', () => {
  it('знімок адресної доставки з city/address = null → «Не вказано», без «null»', () => {
    const { container } = render(
      <I18nProvider locale="uk">
        <OrderDeliveryCard
          order={{
            ...makeOrder(1, new Date()),
            personalDataErasedAt: new Date(),
            shippingData: {
              methodName: 'Кур’єр',
              provider: 'core:address',
              pricing: 'rates',
              destination: { kind: 'address', city: null, address: null },
            } as never,
          }}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('Кур’єр')).toBeTruthy();
    expect(
      screen.getAllByText(createTranslator('uk')('common.notSet')).length,
    ).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/null/);
  });
});
