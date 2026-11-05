// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { makeOrder } from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { OrderDeliveryCard } from '../OrderDeliveryCard';
import { TestI18nProvider, ukT } from '../../../../../../test-harness/i18n';

afterEach(cleanup);

describe('OrderDeliveryCard — знеособлена адреса (Е6г-7)', () => {
  it('знімок адресної доставки з city/address = null → «Не вказано», без «null»', () => {
    const { container } = render(
      <TestI18nProvider>
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
      </TestI18nProvider>,
    );
    expect(screen.getByText('Кур’єр')).toBeTruthy();
    expect(screen.getAllByText(ukT('common.notSet')).length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/null/);
  });
});
