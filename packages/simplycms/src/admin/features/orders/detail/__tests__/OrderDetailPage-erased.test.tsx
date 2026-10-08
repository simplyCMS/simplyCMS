// @vitest-environment jsdom
/**
 * Е6г-16: картка стертого замовлення (покупця видалено) не показує контролів
 * редагування позицій, хоча статус не «Скасоване»; живе замовлення — показує.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import {
  makeOrder,
  reset,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { NEW, DONE, CANCELLED, makeItem } from './support';

const { listOrderStatuses } = vi.hoisted(() => ({
  listOrderStatuses: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('simplycms/admin-server', async () => {
  const stub =
    await import('../../../../../admin-data/__tests__/support/orders-server-stub');
  return (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listOrders: stub.listOrders,
    listOrderItems: stub.listOrderItems,
    listOrderStatuses,
  });
});
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ orderId: 'o0001' }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

import OrderDetailPage from '../OrderDetailPage';

const t = createTranslator('uk');
const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <EngineProvider value={ENGINE}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </EngineProvider>
  </QueryClientProvider>
);
const at = new Date(Date.UTC(2026, 9, 1, 10));

beforeEach(() => listOrderStatuses.mockResolvedValue([NEW, DONE, CANCELLED]));
afterEach(cleanup);

describe('OrderDetailPage — стерте замовлення (Е6г-16)', () => {
  it('живе: «Додати товар» є; стерте: немає, позиції лишились видимими', async () => {
    reset([makeOrder(1, at)], [makeItem(1)]);
    render(<OrderDetailPage />, { wrapper: wrap });
    expect(
      await screen.findByRole('button', { name: t('admin.orders.addItem') }),
    ).toBeTruthy();
    cleanup();

    reset([{ ...makeOrder(1, at), personalDataErasedAt: at }], [makeItem(1)]);
    render(<OrderDetailPage />, { wrapper: wrap });
    await screen.findByText(makeItem(1).name);
    // Статуси завантажені (контрол статусу є) — відсутність кнопки не через isLoading.
    await screen.findByRole('combobox', {
      name: t('admin.orders.statusSection'),
    });
    expect(
      screen.queryByRole('button', { name: t('admin.orders.addItem') }),
    ).toBeNull();
  });
});
