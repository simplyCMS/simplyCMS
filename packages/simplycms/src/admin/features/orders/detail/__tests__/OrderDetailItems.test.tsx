// @vitest-environment jsdom
/** Картка замовлення: позиції, підсумки, попередження про можливе усічення. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { formatPrice } from 'simplycms/domain/money';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import {
  makeOrder,
  reset,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { makeItem, NEW } from './support';

const { listOrderStatuses } = vi.hoisted(() => ({
  listOrderStatuses: vi.fn(),
}));
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
const money = (n: number) => formatPrice(n, ENGINE.config).replace(/\s/g, ' ');
const at = new Date(Date.UTC(2026, 9, 1, 10));
const items = (n: number) =>
  Array.from({ length: n }, (_, i) => makeItem(i + 1));

beforeEach(() => listOrderStatuses.mockResolvedValue([NEW]));
afterEach(cleanup);

describe('OrderDetailPage: позиції й підсумки', () => {
  it('totals: товари, доставка й разом окремо; "1234.50" з копійками', async () => {
    reset(
      [
        {
          ...makeOrder(1, at),
          subtotal: '1234.50',
          shippingCost: '80.00',
          total: '1314.50',
        },
      ],
      [
        makeItem(1, {
          price: '1234.50',
          total: '1234.50',
          basePrice: '1500.00',
          discountData: {
            applied: [{ name: 'Акція', calculatedAmount: 265.5 }],
          },
        }),
      ],
    );
    render(<OrderDetailPage />, { wrapper: wrap });
    await screen.findByText('Товар 1');
    expect(screen.getAllByText(money(1234.5)).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(money(80))).toBeTruthy();
    expect(screen.getByText(money(1314.5))).toBeTruthy();
    expect(
      screen.getByText(t('cart.summary.shipping'), { selector: 'span' }),
    ).toBeTruthy();
    expect(screen.getByText(money(1500))).toBeTruthy();
    expect(screen.getByText(`Акція: -${money(265.5)}`)).toBeTruthy();
  });

  it('рівно 500 позицій → попередження; 499 — без нього', async () => {
    reset([makeOrder(1, at)], items(500));
    render(<OrderDetailPage />, { wrapper: wrap });
    expect(
      await screen.findByText(
        t('admin.orders.itemsMayBeTruncated', { count: 500 }),
      ),
    ).toBeTruthy();
    cleanup();
    reset([makeOrder(1, at)], items(499));
    render(<OrderDetailPage />, { wrapper: wrap });
    await screen.findByText('Товар 499');
    expect(
      screen.queryByText(t('admin.orders.itemsMayBeTruncated', { count: 500 })),
    ).toBeNull();
  });
});
