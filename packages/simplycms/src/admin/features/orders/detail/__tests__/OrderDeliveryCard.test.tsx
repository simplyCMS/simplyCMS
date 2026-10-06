// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from 'simplycms/i18n';
import { makeOrder } from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { OrderDeliveryCard } from '../OrderDeliveryCard';

afterEach(cleanup);

const UUID = '3f1c9a52-7d4e-4b8a-9c11-0a5e6d2b7f10';

const renderCard = (
  shippingData: unknown,
  pickupPointId: string | null = null,
) =>
  render(
    <I18nProvider locale="uk">
      <OrderDeliveryCard
        order={{
          ...makeOrder(1, new Date()),
          pickupPointId,
          shippingData: shippingData as never,
        }}
      />
    </I18nProvider>,
  );

describe('OrderDeliveryCard — знімок доставки (Е6а-8)', () => {
  // Точку потім перейменували («Інша»), а `pickupPointId` занулила FK:
  // картка мусить показати те, що бачив покупець, а не uuid.
  it('показує назву й адресу точки зі знімка при pickupPointId = null', () => {
    renderCard({
      methodName: 'Самовивіз',
      provider: 'core:pickup',
      pricing: 'rates',
      destination: {
        kind: 'pickup-point',
        pointId: 'p-1',
        name: 'Склад у Києві',
        address: 'вул. Складська, 1',
        city: 'Київ',
      },
    });
    expect(screen.getByText('Самовивіз')).toBeTruthy();
    expect(screen.getByText(/Склад у Києві/)).toBeTruthy();
    expect(screen.getByText(/вул\. Складська, 1/)).toBeTruthy();
    expect(screen.queryByText(/Інша/)).toBeNull();
  });

  it('carrier: примітка про оплату перевізнику', () => {
    renderCard({
      methodName: 'Нова Пошта',
      provider: 'core:address',
      pricing: 'carrier',
      destination: { kind: 'address', city: 'Львів', address: 'вул. 5' },
    });
    expect(
      screen.getByText('за тарифами перевізника (оплата при отриманні)'),
    ).toBeTruthy();
  });

  it('без знімка не падає й не показує uuid-сміття', () => {
    const { container } = renderCard({}, UUID);
    expect(screen.getByText('Доставка')).toBeTruthy();
    expect(container.textContent).not.toContain(UUID);
  });
});
