// @vitest-environment jsdom
/**
 * Збереження картки піднімає `products.version` на сервері, а список товарів
 * (колекція, зріз без спостерігача під відкритою карткою) дізнається про це
 * лише через `invalidateCollection` у `reload`. Без нього повернення до списку
 * дає старий `version`, і видалення впирається в 412. Справжня колекція,
 * `staleTime` 5 хв, список розмонтовано на час картки (мутація: прибрати
 * інвалідацію в `reload` → version 1 замість 2). Різницю з `utils.refetch()`
 * доводить тест хелпера, а не цей.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { eq, useLiveQuery } from '@tanstack/react-db';
import type { ReactNode } from 'react';
import { EngineProvider } from 'simplycms/react-query';
import { ENGINE, ResizeObserverStub } from './test-engine-stub';
import { aggregate, ID, LANGUAGES } from './ProductEditPage-fixtures';
import {
  createMutableServer,
  type Payload,
} from '../../../../../admin-data/__tests__/support/mutable-server';

vi.stubGlobal('ResizeObserver', ResizeObserverStub);
const mocks = vi.hoisted(() => ({
  getProduct: vi.fn(),
  listLanguages: vi.fn(),
  saveProductDescription: vi.fn(),
  listProducts: vi.fn(),
  listProductModifications: vi.fn(async () => [] as unknown[]),
}));
vi.mock('simplycms/admin-server', async () =>
  (
    await import('../../../../../admin-server/__tests__/support/admin-server-mock')
  ).createAdminServerMock(mocks),
);
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));
vi.mock('simplycms/core/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('../../../../components/RichTextEditor', () => ({
  RichTextEditor: () => null,
}));
vi.mock('../../stock/StockEditor', () => ({ StockEditor: () => null }));
vi.mock('../../prices/PricesEditor', () => ({ PricesEditor: () => null }));

import { productsCollection, useCollection } from 'simplycms/admin-data';
import { ProductEditPage } from '../ProductEditPage';
import { TestI18nProvider } from '../../../../../../test-harness/i18n';

// Дати читає `ProductMetaCard` з тієї ж колекції.
type Row = { id: string; version: number; createdAt: Date; updatedAt: Date };
const D = new Date(Date.UTC(2026, 9, 1));
const row = (id: string, version: number): Row => ({
  id,
  version,
  createdAt: D,
  updatedAt: D,
});

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('картка → список: свіжий version після збереження', () => {
  it('список після повернення має version збереження (видалення без 412)', async () => {
    const server = createMutableServer<Row>([row(ID, 1), row('other', 1)]);
    mocks.listProducts.mockImplementation(({ data }: { data: Payload }) =>
      server.list({ data }),
    );
    mocks.listLanguages.mockResolvedValue(LANGUAGES);
    mocks.getProduct.mockImplementation(async () =>
      aggregate(false, server.rows[0]!.version),
    );
    mocks.saveProductDescription.mockImplementation(async () => {
      server.upsert(row(ID, 2));
      return { version: 2 };
    });
    const qc = new QueryClient({
      defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>
        <EngineProvider value={ENGINE}>
          <TestI18nProvider>{children}</TestI18nProvider>
        </EngineProvider>
      </QueryClientProvider>
    );
    const useRow = (id: string) =>
      function useRowQuery() {
        const products = useCollection(productsCollection);
        return useLiveQuery((q) =>
          q
            .from({ p: products })
            .where(({ p }) => eq(p.id, id))
            .findOne(),
        );
      };
    // Підписка на інший рядок тримає колекцію живою, поки відкрита картка.
    renderHook(useRow('other'), { wrapper });
    const list = renderHook(useRow(ID), { wrapper });
    await waitFor(() => expect(list.result.current.data).toBeDefined());
    list.unmount();

    const user = userEvent.setup();
    render(<ProductEditPage productId={ID} />, { wrapper });
    await screen.findByDisplayValue('Панель');
    await user.type(screen.getByLabelText(/Назва/), '!');
    await user.click(screen.getAllByRole('button', { name: 'Зберегти' })[0]!);
    await waitFor(() =>
      expect(mocks.saveProductDescription).toHaveBeenCalledTimes(1),
    );
    // Перечитування картки після збереження — це і є `reload`.
    await waitFor(() => expect(mocks.getProduct).toHaveBeenCalledTimes(2));

    const back = renderHook(useRow(ID), { wrapper });
    await waitFor(() => expect(back.result.current.data?.version).toBe(2));
  });
});
