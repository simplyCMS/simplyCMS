// @vitest-environment jsdom
// (vitest.config: environment 'node' — без директиви рендер упаде на
// document is not defined; патерн — як у on-demand-contract.test.tsx.)
/**
 * Список товарів (Task 6): рендер першої сторінки, «Показати ще» з offset,
 * і Review Focus 2 — видалення товару, що є в замовленнях (23503), відкочує
 * оптимістичне видалення й показує тост з ключем `adminErrorKey`.
 *
 * 🔴 Відхилення від тексту плану (Step 6, кейс 2 «фільтр розділу»): замість
 * взаємодії з реальним Radix Select (jsdom 30 не має `hasPointerCapture`/
 * `scrollIntoView`, а `@testing-library/user-event` в репозиторії не
 * встановлений — додавати нову залежність поза скоупом задачі) push-down
 * фільтра перевіряється напряму через `useProductsList` (`renderHook`,
 * зміна `filters` між рендерами) — той самий хук, що й монтує
 * `ProductsPage`, і той самий шлях `toSubsetPayload`, що доводять
 * `on-demand-contract.test.tsx`/`catalog-collections.test.tsx`. Дротова
 * розкладка Select (Radix `Select`/`SelectTrigger`/…) — уже перевірений
 * патерн в інших сторінках адмінки (DiscountGroupEdit, PluginSettings), не
 * новий код цієї задачі.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';

// 🔴 vi.hoisted, не звичайний const (admin-data барелем тягне ВСІ файли
// колекцій — кожен імпортує щось із `simplycms/admin-server`; набір імен —
// той самий, що в `admin-data/__tests__/catalog-collections.test.tsx`).
const { listProducts, listSections, removeProducts } = vi.hoisted(() => ({
  listProducts: vi.fn(async () => [] as unknown[]),
  listSections: vi.fn(async () => [] as unknown[]),
  removeProducts: vi.fn(async () => ({ count: 1 })),
}));
vi.mock('simplycms/admin-server', () => ({
  listOrderStatuses: vi.fn(async () => []),
  insertOrderStatuses: vi.fn(),
  updateOrderStatuses: vi.fn(),
  removeOrderStatuses: vi.fn(),
  listProducts,
  insertProducts: vi.fn(),
  updateProducts: vi.fn(),
  removeProducts,
  listProductModifications: vi.fn(async () => []),
  insertProductModifications: vi.fn(),
  updateProductModifications: vi.fn(),
  removeProductModifications: vi.fn(),
  listProductPrices: vi.fn(async () => []),
  listStock: vi.fn(async () => []),
  listProductPropertyValues: vi.fn(async () => []),
  insertProductPropertyValues: vi.fn(),
  updateProductPropertyValues: vi.fn(),
  removeProductPropertyValues: vi.fn(),
  listModificationPropertyValues: vi.fn(async () => []),
  insertModificationPropertyValues: vi.fn(),
  updateModificationPropertyValues: vi.fn(),
  removeModificationPropertyValues: vi.fn(),
  listSections,
  listPriceTypes: vi.fn(async () => []),
  listSectionPropertyAssignments: vi.fn(async () => []),
  listSectionProperties: vi.fn(async () => []),
  listPropertyOptions: vi.fn(async () => []),
}));

const navigateMock = vi.fn();
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigateMock }));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

import ProductsPage from '../ProductsPage';
import { useProductsList } from '../useProductsList';

const SECTION = { id: 's1', name: 'Ноутбуки' };

function makeProduct(i: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `p${i}`,
    sectionId: SECTION.id,
    slug: `product-${i}`,
    name: `Товар ${i}`,
    images: [],
    isActive: true,
    isFeatured: false,
    stockStatus: 'in_stock',
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk">
        <ProductsPage />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

// 🔴 RTL у цьому репо не має глобального autouse-cleanup (vitest.config.ts —
// без `globals: true`), тому кожен тест сам прибирає DOM і мок-виклики
// попереднього — патерн, як у `Themes.test.tsx`.
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
});

describe('ProductsPage', () => {
  it('(1) перша сторінка: limit=51, сортування createdAt, назва розділу з join-а', async () => {
    listProducts.mockResolvedValueOnce([makeProduct(1)]);
    listSections.mockResolvedValueOnce([SECTION]);
    renderPage();

    await screen.findByText('Товар 1');
    expect(screen.getByText(SECTION.name)).toBeTruthy();
    expect(listProducts).toHaveBeenCalledWith({
      data: {
        subset: expect.objectContaining({
          limit: 51,
          sorts: [{ field: ['createdAt'], direction: 'desc' }],
        }),
      },
    });
  });

  it('(2) фільтр розділу — push-down у serverFn (renderHook, той самий хук)', async () => {
    listProducts.mockResolvedValue([]);
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { rerender } = renderHook(
      ({ sectionId }) => useProductsList({ sectionId }),
      {
        wrapper,
        initialProps: { sectionId: undefined as string | undefined },
      },
    );
    await waitFor(() => expect(listProducts).toHaveBeenCalled());

    rerender({ sectionId: 's1' });
    await waitFor(() =>
      expect(listProducts).toHaveBeenCalledWith({
        data: {
          subset: expect.objectContaining({
            filters: [{ field: ['sectionId'], operator: 'eq', value: 's1' }],
          }),
        },
      }),
    );
  });

  // 🔴 Відхилення від тексту плану («offset: 50»): виміряно бібліотекою
  // (`@tanstack/react-db@0.3.6`, той самий факт, що в
  // `on-demand-contract.test.tsx` (2)) — перша сторінка йде peek-ahead
  // лімітом `pageSize + 1` (51) БЕЗ offset, друга продовжує з
  // `offset: pageSize + 1` (51), `limit: pageSize` (50). «50» плану
  // сплутав offset із limit-ом другої сторінки.
  it('(3) «Показати ще» при 51 рядку відповіді → друга сторінка { limit: 50, offset: 51 }', async () => {
    const first = Array.from({ length: 51 }, (_, i) => makeProduct(i));
    listProducts.mockResolvedValueOnce(first);
    renderPage();

    const button = await screen.findByRole('button', { name: 'Показати ще' });
    await act(async () => {
      button.click();
    });

    await waitFor(() =>
      expect(listProducts).toHaveBeenCalledWith({
        data: { subset: expect.objectContaining({ offset: 51, limit: 50 }) },
      }),
    );
  });

  it('(4) Review Focus 2: 23503 на видаленні → rollback, товар знову в списку, тост conflictReference', async () => {
    listProducts.mockResolvedValueOnce([makeProduct(1)]);
    removeProducts.mockRejectedValueOnce(
      Object.assign(new Error('x'), {
        name: 'AdminConflictError',
        kind: 'reference',
        constraint: 'order_items_product_id_fkey',
      }),
    );
    renderPage();
    await screen.findByText('Товар 1');

    const deleteButton = screen.getByRole('button', { name: 'Видалити' });
    await act(async () => {
      deleteButton.click();
    });
    const dialog = await screen.findByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Видалити' });
    await act(async () => {
      confirm.click();
    });

    // Оптимістичне видалення відкочується — рядок повертається в таблицю.
    await waitFor(() => expect(screen.getByText('Товар 1')).toBeTruthy());
    expect(toastError).toHaveBeenCalledWith(
      'Запис використовується (наприклад, у замовленнях) — деактивуйте його замість видалення',
    );
  });
});
