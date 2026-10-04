// @vitest-environment jsdom
/**
 * Діалог додавання товару в замовлення (Task 6, Е5б-11): debounce 300 мс,
 * відповідь лише на ОСТАННІЙ запит, вибір модифікації, 409 лишає діалог
 * відкритим, успіх — write-back без `listOrderItems`. Тексти — `createTranslator('uk')`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import {
  listOrderItems,
  makeOrder,
  reset,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { CANCELLED, makeItem, NEW } from './support';

const mocks = vi.hoisted(() => ({
  listOrderStatuses: vi.fn(),
  searchProductsForOrder: vi.fn(),
  listProductModifications: vi.fn(),
  addOrderItem: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));
vi.mock('simplycms/admin-server', async () => {
  const stub =
    await import('../../../../../admin-data/__tests__/support/orders-server-stub');
  return (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock({
    listOrders: stub.listOrders,
    listOrderItems: stub.listOrderItems,
    listOrderStatuses: mocks.listOrderStatuses,
    searchProductsForOrder: mocks.searchProductsForOrder,
    listProductModifications: mocks.listProductModifications,
    addOrderItem: mocks.addOrderItem,
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
const at = new Date(Date.UTC(2026, 9, 1, 10));
const hit = (productId: string, name: string, hasModifications = false) => ({
  productId,
  name,
  sku: null,
  hasModifications,
});
const MOD = {
  id: 'm1',
  productId: 'p2',
  slug: 'red',
  name: 'Червоний',
  sku: null,
  images: [],
  sortOrder: 0,
  stockStatus: 'in_stock',
  isDefault: true,
  createdAt: at,
  updatedAt: at,
};
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
const conflict = (constraint: string) =>
  Object.assign(new Error('x'), {
    name: 'AdminConflictError',
    kind: 'state',
    constraint,
  });

/** Відкриває діалог на сторінці замовлення; повертає поле пошуку. */
async function openDialog() {
  render(<OrderDetailPage />, { wrapper: wrap });
  fireEvent.click(
    await screen.findByRole('button', { name: t('admin.orders.addItem') }),
  );
  return screen.findByPlaceholderText(t('admin.orders.searchPlaceholder'));
}
const type = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
const pick = async (name: string) =>
  fireEvent.click(
    await screen.findByRole('button', { name: new RegExp(name) }),
  );
const addButton = () =>
  screen.getByRole('button', { name: t('admin.orders.addToOrder') });

beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient();
  mocks.listOrderStatuses.mockResolvedValue([NEW, CANCELLED]);
  mocks.listProductModifications.mockResolvedValue([MOD]);
  reset([makeOrder(1, at)], [makeItem(1)]);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('AddOrderItemDialog: пошук', () => {
  it('менше 2 символів — запиту немає, лише підказка; debounce 300 мс', async () => {
    const input = await openDialog();
    vi.useFakeTimers();
    mocks.searchProductsForOrder.mockResolvedValue({ items: [] });
    expect(screen.getByText(t('admin.orders.searchHint'))).toBeTruthy();
    type(input, 'a');
    await tick(500);
    expect(mocks.searchProductsForOrder).not.toHaveBeenCalled();
    type(input, 'ab');
    await tick(299);
    expect(mocks.searchProductsForOrder).not.toHaveBeenCalled();
    await tick(1);
    expect(mocks.searchProductsForOrder).toHaveBeenCalledTimes(1);
    expect(mocks.searchProductsForOrder).toHaveBeenCalledWith({
      data: { query: 'ab' },
    });
    expect(screen.getByText(t('admin.orders.searchEmpty'))).toBeTruthy();
  });

  it('застаріла відповідь не перетирає нову (відповіді у зворотному порядку)', async () => {
    const input = await openDialog();
    vi.useFakeTimers();
    const a = deferred<{ items: ReturnType<typeof hit>[] }>();
    const b = deferred<{ items: ReturnType<typeof hit>[] }>();
    mocks.searchProductsForOrder
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise);
    type(input, 'ab');
    await tick(300);
    type(input, 'abc');
    await tick(300);
    expect(mocks.searchProductsForOrder).toHaveBeenCalledTimes(2);
    await act(async () => b.resolve({ items: [hit('pb', 'Новий збіг')] }));
    await act(async () => a.resolve({ items: [hit('pa', 'Застарілий збіг')] }));
    expect(screen.getByText('Новий збіг')).toBeTruthy();
    expect(screen.queryByText('Застарілий збіг')).toBeNull();
  });
});

describe('AddOrderItemDialog: додавання', () => {
  it('товар без модифікацій: modificationId null, кількість з поля', async () => {
    mocks.searchProductsForOrder.mockResolvedValue({
      items: [hit('p1', 'Простий')],
    });
    mocks.addOrderItem.mockResolvedValue({
      order: makeOrder(1, at),
      upserted: [makeItem(2)],
      removedIds: [],
    });
    const input = await openDialog();
    type(input, 'пр');
    await pick('Простий');
    fireEvent.change(screen.getByLabelText(t('common.quantity')), {
      target: { value: '3' },
    });
    fireEvent.click(addButton());
    await waitFor(() => expect(mocks.addOrderItem).toHaveBeenCalledTimes(1));
    expect(mocks.addOrderItem).toHaveBeenCalledWith({
      data: {
        orderId: 'o0001',
        productId: 'p1',
        modificationId: null,
        quantity: 3,
      },
    });
    // Успіх: діалог закрито, позиція — write-back без listOrderItems.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Товар 2')).toBeTruthy();
    expect(listOrderItems).toHaveBeenCalledTimes(1);
  });

  it('товар із модифікаціями: «Додати» вимкнена до вибору модифікації', async () => {
    mocks.searchProductsForOrder.mockResolvedValue({
      items: [hit('p2', 'Із варіантами', true)],
    });
    mocks.addOrderItem.mockResolvedValue({
      order: makeOrder(1, at),
      upserted: [makeItem(2)],
      removedIds: [],
    });
    const input = await openDialog();
    type(input, 'із');
    await pick('Із варіантами');
    expect(
      await screen.findByText(
        t('admin.orders.pickModification', { name: 'Із варіантами' }),
      ),
    ).toBeTruthy();
    expect((addButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: /Червоний/ }));
    expect((addButton() as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(addButton());
    await waitFor(() =>
      expect(mocks.addOrderItem).toHaveBeenCalledWith({
        data: {
          orderId: 'o0001',
          productId: 'p2',
          modificationId: 'm1',
          quantity: 1,
        },
      }),
    );
  });

  it('кількість поза 1…9999 — «Додати» вимкнена', async () => {
    mocks.searchProductsForOrder.mockResolvedValue({
      items: [hit('p1', 'Простий')],
    });
    const input = await openDialog();
    type(input, 'пр');
    await pick('Простий');
    const q = screen.getByLabelText(t('common.quantity'));
    for (const bad of ['0', '10000', '']) {
      fireEvent.change(q, { target: { value: bad } });
      expect((addButton() as HTMLButtonElement).disabled).toBe(true);
    }
    fireEvent.change(q, { target: { value: '9999' } });
    expect((addButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it.each([
    ['order_item_not_purchasable', 'admin.errors.orderItemNotPurchasable'],
    ['order_insufficient_stock', 'admin.errors.orderInsufficientStock'],
    ['order_shipping_unavailable', 'admin.errors.orderShippingUnavailable'],
  ] as const)('409 %s: точний тост, діалог відкритий', async (code, key) => {
    mocks.searchProductsForOrder.mockResolvedValue({
      items: [hit('p1', 'Простий')],
    });
    mocks.addOrderItem.mockRejectedValue(conflict(code));
    const input = await openDialog();
    type(input, 'пр');
    await pick('Простий');
    fireEvent.click(addButton());
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(t(key)));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(t('admin.orders.addItemTitle')),
    ).toBeTruthy();
    expect((addButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('подвійний клік «Додати» — один виклик', async () => {
    mocks.searchProductsForOrder.mockResolvedValue({
      items: [hit('p1', 'Простий')],
    });
    const d = deferred<unknown>();
    mocks.addOrderItem.mockReturnValue(d.promise);
    const input = await openDialog();
    type(input, 'пр');
    await pick('Простий');
    const btn = addButton();
    // Обидва кліки в одному act: перемальовки між ними немає, тож `disabled`
    // ще не виставлено — доводить саме in-flight ref.
    act(() => {
      btn.click();
      btn.click();
    });
    expect(mocks.addOrderItem).toHaveBeenCalledTimes(1);
    await act(async () =>
      d.resolve({
        order: makeOrder(1, at),
        upserted: [makeItem(2)],
        removedIds: [],
      }),
    );
  });

  it('скасоване замовлення: кнопки «Додати товар» немає', async () => {
    reset([makeOrder(1, at, CANCELLED.id)], [makeItem(1)]);
    render(<OrderDetailPage />, { wrapper: wrap });
    await screen.findByText(t('admin.orders.cancelledFinal'));
    expect(
      screen.queryByRole('button', { name: t('admin.orders.addItem') }),
    ).toBeNull();
  });
});
