/**
 * Спільне для тестів діалогу додавання товару (Task 6 Е5б; розбито на файли
 * ≤ 150 рядків у Task 8). 🔴 `vi.mock(...)` лишається в КОЖНОМУ тест-файлі,
 * а сторінку тест передає сам — інакше фабрика моку імпортувала б модуль,
 * що сам тягне замоканий `simplycms/admin-server` (цикл).
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, vi, type Mock } from 'vitest';
import { cleanup } from '@testing-library/react';
import { createTranslator, I18nProvider } from 'simplycms/i18n';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE } from '../../../products/edit/__tests__/test-engine-stub';
import {
  makeOrder,
  reset,
} from '../../../../../admin-data/__tests__/support/orders-server-stub';
import { CANCELLED, makeItem, NEW } from './support';

export const t = createTranslator('uk');
export const at = new Date(Date.UTC(2026, 9, 1, 10));
export const hit = (
  productId: string,
  name: string,
  hasModifications = false,
) => ({ productId, name, sku: null, hasModifications });
export const MOD = {
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
export const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};
export const conflict = (constraint: string) =>
  Object.assign(new Error('x'), {
    name: 'AdminConflictError',
    kind: 'state',
    constraint,
  });

let client = new QueryClient();
const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>
    <EngineProvider value={ENGINE}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </EngineProvider>
  </QueryClientProvider>
);

/** Рендер сторінки замовлення в обгортці тесту. */
export const renderPage = (page: ReactElement) =>
  render(page, { wrapper: wrap });

/** Відкриває діалог на сторінці замовлення; повертає поле пошуку. */
export async function openDialog(page: ReactElement) {
  renderPage(page);
  fireEvent.click(
    await screen.findByRole('button', { name: t('admin.orders.addItem') }),
  );
  return screen.findByPlaceholderText(t('admin.orders.searchPlaceholder'));
}
export const type = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });
export const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
export const pick = async (name: string) =>
  fireEvent.click(
    await screen.findByRole('button', { name: new RegExp(name) }),
  );
export const addButton = () =>
  screen.getByRole('button', { name: t('admin.orders.addToOrder') });

/** Спільні beforeEach/afterEach; `mocks` — vi.hoisted тест-файлу. */
export function registerDialogTestState(mocks: {
  listOrderStatuses: Mock;
  listProductModifications: Mock;
}) {
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
}
