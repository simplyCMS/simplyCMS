// @vitest-environment jsdom
// Е5б Task 8 (G): поки зміна позиції в польоті, друга не шлеться — ні
// «Enter, потім blur» у полі кількості, ні повторне підтвердження видалення.
// Справжні колекції + стаб межі serverFn, як у `OrderItemsEdit.test.tsx`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import {
  makeOrder,
  reset,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { CANCELLED, makeItem, NEW } from './support';

const mocks = vi.hoisted(() => ({
  listOrderStatuses: vi.fn(),
  updateOrderItemQuantity: vi.fn(),
  removeOrderItem: vi.fn(),
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
    ...mocks,
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
const order = makeOrder(1, new Date(Date.UTC(2026, 9, 1, 10)));
/** Відповідь serverFn, яку тест відпускає сам (`release`). */
function held() {
  let release!: (v: unknown) => void;
  const promise = new Promise((r) => {
    release = r;
  });
  return { promise, release };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listOrderStatuses.mockResolvedValue([NEW, CANCELLED]);
  reset([order], [makeItem(1), makeItem(2)]);
});
afterEach(cleanup);

describe('позиції замовлення: запит у польоті', () => {
  it('кількість: Enter, потім blur — один виклик', async () => {
    const h = held();
    mocks.updateOrderItemQuantity.mockReturnValueOnce(h.promise);
    render(<OrderDetailPage />, { wrapper: wrap });
    const input = await screen.findByLabelText(
      `${t('common.quantity')}: Товар 1`,
    );
    fireEvent.change(input, { target: { value: '3' } });
    // Обидві події в одному батчі React — як blur, що браузер шле в тому ж
    // циклі подій, до ререндеру з `disabled`: стан `busy` ще старий.
    act(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.blur(input);
    });
    expect(mocks.updateOrderItemQuantity).toHaveBeenCalledTimes(1);
    await act(async () => {
      h.release({
        order,
        upserted: [makeItem(1, { quantity: 3, total: '300.00' })],
        removedIds: [],
      });
    });
    expect(mocks.updateOrderItemQuantity).toHaveBeenCalledTimes(1);
  });

  it('видалення: повторне підтвердження, поки перше летить, — без другого виклику', async () => {
    const h = held();
    mocks.removeOrderItem.mockReturnValueOnce(h.promise);
    render(<OrderDetailPage />, { wrapper: wrap });
    const confirm = async () => {
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
    await confirm();
    await confirm();
    expect(mocks.removeOrderItem).toHaveBeenCalledTimes(1);
    await act(async () => {
      h.release({ order, upserted: [], removedIds: ['i0002'] });
    });
    expect(screen.queryByText('Товар 2')).toBeNull();
  });
});
