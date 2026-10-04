// @vitest-environment jsdom
// Е5б Task 8 (G): після помилки колекції незмінні (Е5б-11), після видалення
// — підсумки з відповіді сервера, неціла кількість не надсилається.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  getCollection,
  orderItemsCollection,
  ordersCollection,
} from 'simplycms/admin-data';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { formatPrice } from 'simplycms/domain/money';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import {
  makeOrder,
  reset,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { AdminConflictError } from '../../../../../admin-server/impl/errors';
import { CANCELLED, makeItem, NEW } from './support';

const { server, toastError } = vi.hoisted(() => ({
  server: {
    listOrderStatuses: vi.fn(),
    updateOrderItemQuantity: vi.fn(),
    removeOrderItem: vi.fn(),
  },
  toastError: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock('simplycms/admin-server', async () => {
  const stub =
    await import('../../../../../admin-data/__tests__/support/orders-server-stub');
  return (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listOrders: stub.listOrders,
    listOrderItems: stub.listOrderItems,
    ...server,
  });
});
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ orderId: 'o0001' }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

import OrderDetailPage from '../OrderDetailPage';

const t = createTranslator('uk');
let client = new QueryClient();
const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>
    <EngineProvider value={ENGINE}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </EngineProvider>
  </QueryClientProvider>
);
const money = (n: number) => formatPrice(n, ENGINE.config).replace(/\s/g, ' ');
const order = {
  ...makeOrder(1, new Date(Date.UTC(2026, 9, 1, 10))),
  ...{ subtotal: '200.00', shippingCost: '50.00', total: '250.00' },
};
/** Знімок обох колекцій — доказ «стан незмінний» після помилки. */
const snapshot = () => [
  [...getCollection(client, ordersCollection).state.values()],
  [...getCollection(client, orderItemsCollection).state.values()],
];
const qty = () => screen.findByLabelText(`${t('common.quantity')}: Товар 1`);
const removeItem2 = async () => {
  fireEvent.click(
    await screen.findByRole('button', {
      name: `${t('common.delete')}: Товар 2`,
    }),
  );
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(
    within(dialog).getByRole('button', { name: t('common.delete') }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient();
  server.listOrderStatuses.mockResolvedValue([NEW, CANCELLED]);
  reset([order], [makeItem(1), makeItem(2)]);
});
afterEach(cleanup);

describe('позиції замовлення: наслідки операцій', () => {
  it('409 кількості → тост, обидві колекції незмінні', async () => {
    server.updateOrderItemQuantity.mockRejectedValue(
      new AdminConflictError('state', 'order_insufficient_stock'),
    );
    render(<OrderDetailPage />, { wrapper: wrap });
    const input = (await qty()) as HTMLInputElement;
    const before = snapshot();
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.blur(input);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    await waitFor(() => expect(input.value).toBe('1'));
    expect(snapshot()).toEqual(before);
  });

  it('помилка видалення → тост, позиція на місці, колекції незмінні', async () => {
    server.removeOrderItem.mockRejectedValue(
      new AdminConflictError('state', 'order_last_item'),
    );
    render(<OrderDetailPage />, { wrapper: wrap });
    await qty();
    const before = snapshot();
    await removeItem2();
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(t('admin.errors.orderLastItem')),
    );
    expect(screen.getByText('Товар 2')).toBeTruthy();
    expect(snapshot()).toEqual(before);
  });

  it('видалення → підсумки з відповіді сервера (товари, доставка, разом)', async () => {
    server.removeOrderItem.mockResolvedValue({
      order: { ...order, subtotal: '100.00', total: '150.00' },
      upserted: [],
      removedIds: ['i0002'],
    });
    render(<OrderDetailPage />, { wrapper: wrap });
    await screen.findByText(money(250));
    await removeItem2();
    await screen.findByText(money(150));
    expect(screen.queryByText(money(250))).toBeNull();
    expect(screen.getByText(money(50))).toBeTruthy();
  });

  it('неціле 1.5 → виклику немає, поле повертається', async () => {
    render(<OrderDetailPage />, { wrapper: wrap });
    const input = (await qty()) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(input.value).toBe('1'));
    expect(server.updateOrderItemQuantity).not.toHaveBeenCalled();
  });
});
