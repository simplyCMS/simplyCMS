// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AdminOrder } from 'simplycms/admin-data';
import { I18nProvider, createTranslator } from 'simplycms/i18n';
import { makeOrder } from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { OrderCustomerCard } from '../OrderCustomerCard';

afterEach(cleanup);
const t = createTranslator('uk');

const renderCard = (over: Partial<AdminOrder>) =>
  render(
    <I18nProvider locale="uk">
      <OrderCustomerCard order={{ ...makeOrder(1, new Date()), ...over }} />
    </I18nProvider>,
  );

describe('OrderCustomerCard — знеособлене замовлення (Е6г)', () => {
  it('стерте: «Видалений покупець», без null і без контактів та блока одержувача', () => {
    const { container } = renderCard({
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
      hasDifferentRecipient: true,
      recipientFirstName: null,
      personalDataErasedAt: new Date(),
    });
    expect(screen.getByText(t('admin.orders.erasedCustomer'))).toBeTruthy();
    expect(container.textContent).not.toMatch(/null/);
    expect(screen.queryByText(t('admin.orders.emailLabel'))).toBeNull();
    expect(screen.queryByText(t('admin.orders.phoneLabel'))).toBeNull();
    expect(screen.queryByText(t('checkout.success.recipient'))).toBeNull();
  });

  it('живе замовлення: імʼя й контакти на місці', () => {
    renderCard({});
    expect(screen.getByText('Ім’я Прізвище')).toBeTruthy();
    expect(screen.getByText('c1@example.test')).toBeTruthy();
    expect(screen.queryByText(t('admin.orders.erasedCustomer'))).toBeNull();
  });
});
