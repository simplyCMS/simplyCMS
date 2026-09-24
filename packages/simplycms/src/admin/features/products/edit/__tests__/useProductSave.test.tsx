// @vitest-environment jsdom
// (vitest.config: environment 'node' — без директиви renderHook упаде на
// document is not defined; патерн — як у on-demand-contract.test.tsx.)
/**
 * `useProductSave` (Task 7, Step 2): (а) create кличе `insertProducts` з
 * повним рядком, після успіху — navigate на `$productId = id`; (б) Review
 * Focus 1 — конфлікт slug → тост `admin.errors.slugTaken`, navigate НЕ
 * викликано; (в) update кличе `updateProducts` з `[{ id, patch }]`, де
 * `patch.sku === null` при `hasModifications: true`.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { I18nProvider } from 'simplycms/i18n';

// 🔴 vi.hoisted, не звичайний const (admin-data барелем тягне ВСІ файли
// колекцій — кожен імпортує щось із `simplycms/admin-server`; набір імен —
// той самий, що в `ProductsPage.test.tsx`).
const { insertProducts, updateProducts, listProducts } = vi.hoisted(() => ({
  insertProducts: vi.fn(
    async ({ data }: { data: Array<{ id: string }> }) => data,
  ),
  updateProducts: vi.fn(
    async ({ data }: { data: Array<{ id: string; patch: object }> }) =>
      data.map((d) => ({ id: d.id, ...d.patch })),
  ),
  listProducts: vi.fn(async () => [] as unknown[]),
}));
vi.mock('simplycms/admin-server', () => ({
  listOrderStatuses: vi.fn(async () => []),
  insertOrderStatuses: vi.fn(),
  updateOrderStatuses: vi.fn(),
  removeOrderStatuses: vi.fn(),
  listProducts,
  insertProducts,
  updateProducts,
  removeProducts: vi.fn(),
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
  listSections: vi.fn(async () => []),
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

import { eq, useLiveQuery } from '@tanstack/react-db';
import { productsCollection, useCollection } from 'simplycms/admin-data';
import { useProductSave } from '../useProductSave';
import type { ProductFormValues } from '../product-form-schema';

const values: ProductFormValues = {
  name: 'Панель',
  slug: 'panel',
  shortDescription: '',
  description: '',
  metaTitle: '',
  metaDescription: '',
  sectionId: 's1',
  isActive: true,
  isFeatured: false,
  hasModifications: false,
  sku: 'SKU-1',
  stockStatus: 'in_stock',
  images: [],
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale="uk">{children}</I18nProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useProductSave', () => {
  it('(а) create: insertProducts з рядком форми, успіх → navigate на новий id', async () => {
    const { result } = renderHook(() => useProductSave(), { wrapper });
    await result.current.create(values);

    expect(insertProducts).toHaveBeenCalledTimes(1);
    const [{ data }] = insertProducts.mock.calls[0] as [
      { data: Array<{ id: string; slug: string }> },
    ];
    expect(data[0]?.slug).toBe('panel');
    const id = data[0]!.id;
    expect(toastSuccess).toHaveBeenCalledWith('Товар створено');
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/admin/products/$productId',
      params: { productId: id },
    });
  });

  it('(б) Review Focus 1: конфлікт slug → тост slugTaken, navigate НЕ викликано', async () => {
    insertProducts.mockRejectedValueOnce(
      Object.assign(new Error('x'), {
        name: 'AdminConflictError',
        kind: 'unique',
        constraint: 'products_slug_key',
      }),
    );
    const { result } = renderHook(() => useProductSave(), { wrapper });
    await result.current.create(values);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        'Такий URL (slug) уже зайнятий — змініть його',
      ),
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('(в) update: updateProducts з [{ id, patch }], sku null при hasModifications', async () => {
    // 🔴 `collection.update` вимагає, щоб рядок уже був у синхронізованому
    // стані колекції (виміряно) — у реальній сторінці це гарантує `findOne`
    // `ProductEditPage`, тож тест відтворює те саме перед викликом update.
    // 🔴 `stockStatus` в БД відрізняється від форми, щоб потрапити в diff
    // мутації (TanStack DB шле лише ЗМІНЕНІ поля, не весь patch — незмінене
    // 'in_stock' → 'in_stock' інакше випало б з `m.changes`).
    listProducts.mockResolvedValueOnce([
      { ...values, id: 'p1', stockStatus: 'out_of_stock' },
    ]);
    const { result } = renderHook(
      () => {
        const products = useCollection(productsCollection);
        useLiveQuery((q) =>
          q
            .from({ p: products })
            .where(({ p }) => eq(p.id, 'p1'))
            .findOne(),
        );
        return useProductSave();
      },
      { wrapper },
    );
    await waitFor(() => expect(listProducts).toHaveBeenCalled());
    await result.current.update('p1', { ...values, hasModifications: true });

    expect(updateProducts).toHaveBeenCalledTimes(1);
    const [{ data }] = updateProducts.mock.calls[0] as [
      { data: Array<{ id: string; patch: { sku: string | null } }> },
    ];
    expect(data[0]).toMatchObject({
      id: 'p1',
      patch: expect.objectContaining({ sku: null, stockStatus: 'in_stock' }),
    });
    expect(toastSuccess).toHaveBeenCalledWith('Товар оновлено');
  });
});
